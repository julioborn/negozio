-- ============================================================
-- NEGOZIO — Setup módulo de ventas
-- Ejecutar DESPUÉS de stock_setup.sql
-- SAFE TO RE-RUN
-- ============================================================


-- ─── 0. Limpieza ─────────────────────────────────────────────
drop function if exists public.process_sale(uuid, uuid, text, numeric, numeric, jsonb) cascade;
drop table if exists public.sale_items cascade;
drop table if exists public.sales      cascade;


-- ─── 1. Tabla sales ──────────────────────────────────────────
create table public.sales (
  id               uuid          primary key default gen_random_uuid(),
  establishment_id uuid          not null references public.establishments(id) on delete cascade,
  cashier_id       uuid          not null references auth.users(id),
  sale_number      text          not null,
  channel          text          not null default 'local'
                     check (channel in ('local', 'mercadolibre', 'instagram', 'whatsapp', 'other')),
  status           text          not null default 'completed'
                     check (status in ('completed', 'cancelled', 'refunded')),
  payment_method   text          not null
                     check (payment_method in ('cash', 'card', 'transfer', 'mercadopago', 'other')),
  subtotal         numeric(12,2) not null,
  discount_pct     numeric(5,2)  not null default 0 check (discount_pct >= 0 and discount_pct <= 100),
  total            numeric(12,2) not null,
  amount_paid      numeric(12,2) null,
  change_given     numeric(12,2) null,
  notes            text          null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),

  unique (establishment_id, sale_number)
);

create trigger sales_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

create index sales_establishment_idx on public.sales (establishment_id);
create index sales_created_at_idx    on public.sales (establishment_id, created_at desc);

alter table public.sales enable row level security;

create policy "Cajeros y owners ven ventas"
  on public.sales for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = sales.establishment_id
        and p.role in ('owner', 'cashier')
    )
  );

create policy "Cajeros y owners crean ventas"
  on public.sales for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = sales.establishment_id
        and p.role in ('owner', 'cashier')
    )
  );


-- ─── 2. Tabla sale_items ─────────────────────────────────────
create table public.sale_items (
  id                       uuid          primary key default gen_random_uuid(),
  sale_id                  uuid          not null references public.sales(id) on delete cascade,
  establishment_product_id uuid          null references public.establishment_products(id) on delete set null,
  product_name             text          not null,
  product_barcode          text          null,
  quantity                 integer       not null check (quantity > 0),
  unit_price               numeric(12,2) not null,
  discount_pct             numeric(5,2)  not null default 0,
  subtotal                 numeric(12,2) not null
);

create index sale_items_sale_idx on public.sale_items (sale_id);

alter table public.sale_items enable row level security;

create policy "Miembros ven items de venta"
  on public.sale_items for select
  using (
    exists (
      select 1 from public.sales s
      join public.profiles p on p.establishment_id = s.establishment_id
      where s.id = sale_items.sale_id
        and p.id = auth.uid()
        and p.role in ('owner', 'cashier')
    )
  );

create policy "Cajeros crean items"
  on public.sale_items for insert
  with check (
    exists (
      select 1 from public.sales s
      join public.profiles p on p.establishment_id = s.establishment_id
      where s.id = sale_items.sale_id
        and p.id = auth.uid()
    )
  );


-- ─── 3. RPC: procesar venta completa (atómica) ───────────────
create or replace function public.process_sale(
  p_establishment_id uuid,
  p_cashier_id       uuid,
  p_payment_method   text,
  p_discount_pct     numeric,
  p_amount_paid      numeric,   -- null para no-efectivo
  p_items            jsonb      -- [{ep_id, name, barcode, quantity, unit_price, discount_pct}]
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sale_id       uuid;
  v_sale_number   text;
  v_item          jsonb;
  v_subtotal      numeric := 0;
  v_total         numeric;
  v_item_sub      numeric;
  v_ep_id         uuid;
  v_cur_stock     integer;
  v_qty           integer;
  v_change        numeric;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto';
  end if;

  -- Generar número de venta (V-YYYYMMDD-NNNN)
  select
    'V-' || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'YYYYMMDD') || '-' ||
    lpad(
      ((select count(*) from public.sales
        where establishment_id = p_establishment_id
          and (created_at at time zone 'America/Argentina/Buenos_Aires')::date =
              (now() at time zone 'America/Argentina/Buenos_Aires')::date
       )::integer + 1)::text,
      4, '0'
    )
  into v_sale_number;

  -- Calcular subtotal
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_sub := (v_item->>'unit_price')::numeric
      * (v_item->>'quantity')::integer
      * (1 - coalesce((v_item->>'discount_pct')::numeric, 0) / 100);
    v_subtotal := v_subtotal + v_item_sub;
  end loop;

  v_total  := round(v_subtotal * (1 - p_discount_pct / 100), 2);
  v_change := case when p_payment_method = 'cash' and p_amount_paid is not null
                   then round(p_amount_paid - v_total, 2)
                   else null end;

  -- Insertar venta
  insert into public.sales (
    establishment_id, cashier_id, sale_number,
    payment_method, subtotal, discount_pct, total,
    amount_paid, change_given, status
  ) values (
    p_establishment_id, p_cashier_id, v_sale_number,
    p_payment_method, v_subtotal, p_discount_pct, v_total,
    p_amount_paid, v_change, 'completed'
  ) returning id into v_sale_id;

  -- Insertar items y movimientos de stock
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    v_item_sub := (v_item->>'unit_price')::numeric
      * v_qty
      * (1 - coalesce((v_item->>'discount_pct')::numeric, 0) / 100);

    v_ep_id := case
      when (v_item->>'ep_id') is not null and (v_item->>'ep_id') <> 'null'
      then (v_item->>'ep_id')::uuid
      else null
    end;

    insert into public.sale_items (
      sale_id, establishment_product_id,
      product_name, product_barcode,
      quantity, unit_price, discount_pct, subtotal
    ) values (
      v_sale_id, v_ep_id,
      v_item->>'name', v_item->>'barcode',
      v_qty, (v_item->>'unit_price')::numeric,
      coalesce((v_item->>'discount_pct')::numeric, 0),
      round(v_item_sub, 2)
    );

    -- Movimiento de stock solo para productos reales
    if v_ep_id is not null then
      select stock into v_cur_stock
      from public.establishment_products where id = v_ep_id;

      insert into public.stock_movements (
        establishment_product_id,
        type, reason, quantity,
        previous_stock, new_stock,
        created_by
      ) values (
        v_ep_id, 'out', 'sale', v_qty,
        v_cur_stock, greatest(0, v_cur_stock - v_qty),
        p_cashier_id
      );
    end if;
  end loop;

  return jsonb_build_object(
    'sale_id',      v_sale_id,
    'sale_number',  v_sale_number,
    'subtotal',     v_subtotal,
    'discount_pct', p_discount_pct,
    'total',        v_total,
    'amount_paid',  p_amount_paid,
    'change_given', v_change
  );
end;
$$;
