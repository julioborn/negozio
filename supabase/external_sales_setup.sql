-- ============================================================
-- NEGOZIO — Setup módulo de ventas externas
-- Ejecutar DESPUÉS de stock_setup.sql
-- SAFE TO RE-RUN
-- ============================================================


-- ─── 0. Limpieza ─────────────────────────────────────────────
drop function if exists public.confirm_external_sale(uuid, uuid, boolean, numeric, text, text, text, jsonb) cascade;
drop table if exists public.external_sale_items cascade;
drop table if exists public.external_sales      cascade;


-- ─── 1. Extender stock_movements ────────────────────────────
-- Agregar device_type y ampliar el check de reason

alter table public.stock_movements
  add column if not exists device_type text null
    check (device_type in ('desktop', 'mobile'));

-- Reemplazar constraint de reason para incluir 'external_sale'
do $$ begin
  alter table public.stock_movements
    drop constraint stock_movements_reason_check;
exception when undefined_object then null;
end $$;

alter table public.stock_movements
  add constraint stock_movements_reason_check
  check (reason in ('supplier', 'sale', 'return', 'loss', 'manual', 'correction', 'external_sale'));


-- ─── 2. Tabla external_sales ─────────────────────────────────
create table public.external_sales (
  id               uuid          primary key default gen_random_uuid(),
  establishment_id uuid          not null references public.establishments(id) on delete cascade,
  seller_id        uuid          not null references auth.users(id),
  register_payment boolean       not null default true,
  total            numeric(12,2) null,
  payment_method   text          null check (payment_method in ('cash', 'transfer')),
  customer_name    text          null,
  notes            text          null,
  status           text          not null default 'confirmed'
                     check (status in ('confirmed', 'cancelled')),
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

create trigger external_sales_updated_at
  before update on public.external_sales
  for each row execute function public.set_updated_at();

create index external_sales_establishment_idx on public.external_sales (establishment_id);

alter table public.external_sales enable row level security;

create policy "Owner ve sus ventas externas"
  on public.external_sales for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = external_sales.establishment_id
        and p.role = 'owner'
    )
  );

create policy "Owner crea ventas externas"
  on public.external_sales for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = external_sales.establishment_id
        and p.role = 'owner'
    )
  );


-- ─── 3. Tabla external_sale_items ────────────────────────────
create table public.external_sale_items (
  id                       uuid          primary key default gen_random_uuid(),
  external_sale_id         uuid          not null references public.external_sales(id) on delete cascade,
  establishment_product_id uuid          not null references public.establishment_products(id) on delete restrict,
  product_name             text          not null,
  product_barcode          text          null,
  quantity                 integer       not null check (quantity > 0),
  unit_price               numeric(12,2) null,
  subtotal                 numeric(12,2) null
);

create index ext_sale_items_sale_idx on public.external_sale_items (external_sale_id);

alter table public.external_sale_items enable row level security;

create policy "Owner ve items de sus ventas externas"
  on public.external_sale_items for select
  using (
    exists (
      select 1 from public.external_sales es
      join public.profiles p on p.establishment_id = es.establishment_id
      where es.id = external_sale_items.external_sale_id
        and p.id = auth.uid()
        and p.role = 'owner'
    )
  );

create policy "Owner crea items"
  on public.external_sale_items for insert
  with check (
    exists (
      select 1 from public.external_sales es
      join public.profiles p on p.establishment_id = es.establishment_id
      where es.id = external_sale_items.external_sale_id
        and p.id = auth.uid()
    )
  );


-- ─── 4. RPC: confirm_external_sale ───────────────────────────
-- Valida stock, crea external_sale + items + stock_movements en una transacción.

create or replace function public.confirm_external_sale(
  p_establishment_id uuid,
  p_seller_id        uuid,
  p_register_payment boolean,
  p_total            numeric,    -- null si register_payment = false
  p_payment_method   text,       -- null si register_payment = false
  p_customer_name    text,
  p_notes            text,
  p_items            jsonb       -- [{ep_id, name, barcode, quantity, unit_price}]
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sale_id   uuid;
  v_item      jsonb;
  v_ep        record;
  v_qty       integer;
  v_movements jsonb := '[]'::jsonb;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Debe haber al menos un producto';
  end if;

  -- ── Validar stock primero (antes de cualquier insert) ──────
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    select * into v_ep
    from public.establishment_products
    where id = (v_item->>'ep_id')::uuid
      and establishment_id = p_establishment_id;

    if not found then
      raise exception 'Producto no encontrado en el establecimiento';
    end if;

    if v_ep.stock < v_qty then
      raise exception 'Stock insuficiente para "%": hay % y se quieren vender %',
        v_item->>'name', v_ep.stock, v_qty;
    end if;
  end loop;

  -- ── Crear venta externa ────────────────────────────────────
  insert into public.external_sales (
    establishment_id, seller_id,
    register_payment, total, payment_method,
    customer_name, notes, status
  ) values (
    p_establishment_id, p_seller_id,
    p_register_payment,
    case when p_register_payment then p_total else null end,
    case when p_register_payment then p_payment_method else null end,
    p_customer_name, p_notes, 'confirmed'
  ) returning id into v_sale_id;

  -- ── Crear items y movimientos de stock ─────────────────────
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;

    select * into v_ep
    from public.establishment_products
    where id = (v_item->>'ep_id')::uuid;

    -- Item
    insert into public.external_sale_items (
      external_sale_id, establishment_product_id,
      product_name, product_barcode,
      quantity, unit_price,
      subtotal
    ) values (
      v_sale_id, v_ep.id,
      v_item->>'name',
      v_item->>'barcode',
      v_qty,
      case when (v_item->>'unit_price') is not null
           then (v_item->>'unit_price')::numeric else null end,
      case when (v_item->>'unit_price') is not null
           then (v_item->>'unit_price')::numeric * v_qty else null end
    );

    -- Movimiento de stock
    insert into public.stock_movements (
      establishment_product_id,
      type, reason, device_type,
      quantity, previous_stock, new_stock,
      created_by
    ) values (
      v_ep.id,
      'out', 'external_sale', 'mobile',
      v_qty, v_ep.stock, v_ep.stock - v_qty,
      p_seller_id
    );

    v_movements := v_movements || jsonb_build_object(
      'ep_id',          v_ep.id,
      'name',           v_item->>'name',
      'quantity',       v_qty,
      'previous_stock', v_ep.stock,
      'new_stock',      v_ep.stock - v_qty
    );
  end loop;

  return jsonb_build_object(
    'sale_id',   v_sale_id,
    'movements', v_movements
  );
end;
$$;
