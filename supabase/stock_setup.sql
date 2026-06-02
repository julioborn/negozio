-- ============================================================
-- NEGOZIO — Setup módulo de stock / ingreso de mercadería
-- Ejecutar DESPUÉS de products_setup.sql
-- SAFE TO RE-RUN
-- ============================================================


-- ─── 0. Limpieza ─────────────────────────────────────────────
drop table if exists public.stock_movements   cascade;
drop table if exists public.supplier_orders   cascade;
drop table if exists public.suppliers         cascade;

drop function if exists public.process_stock_movement() cascade;
drop function if exists public.confirm_supplier_order(uuid, uuid, uuid, text, jsonb) cascade;


-- ─── 1. Tabla suppliers ──────────────────────────────────────
create table public.suppliers (
  id               uuid        primary key default gen_random_uuid(),
  establishment_id uuid        not null references public.establishments(id) on delete cascade,
  name             text        not null,
  contact_name     text        null,
  phone            text        null,
  email            text        null,
  notes            text        null,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

create index suppliers_establishment_idx on public.suppliers (establishment_id);

alter table public.suppliers enable row level security;

create policy "Miembros ven proveedores de su establecimiento"
  on public.suppliers for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = suppliers.establishment_id
    )
  );

create policy "Owner gestiona proveedores"
  on public.suppliers for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = suppliers.establishment_id
        and p.role = 'owner'
    )
  );


-- ─── 2. Tabla supplier_orders ────────────────────────────────
create table public.supplier_orders (
  id               uuid        primary key default gen_random_uuid(),
  establishment_id uuid        not null references public.establishments(id) on delete cascade,
  supplier_id      uuid        null references public.suppliers(id) on delete set null,
  status           text        not null default 'confirmed'
                     check (status in ('draft', 'confirmed', 'cancelled')),
  total_items      integer     not null default 0,
  notes            text        null,
  created_by       uuid        not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger supplier_orders_updated_at
  before update on public.supplier_orders
  for each row execute function public.set_updated_at();

create index supplier_orders_establishment_idx on public.supplier_orders (establishment_id);

alter table public.supplier_orders enable row level security;

create policy "Miembros ven órdenes de su establecimiento"
  on public.supplier_orders for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = supplier_orders.establishment_id
    )
  );

create policy "Owner y empleados crean órdenes"
  on public.supplier_orders for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = supplier_orders.establishment_id
        and p.role in ('owner', 'employee')
    )
  );


-- ─── 3. Tabla stock_movements ────────────────────────────────
create table public.stock_movements (
  id                       uuid          primary key default gen_random_uuid(),
  establishment_product_id uuid          not null references public.establishment_products(id) on delete cascade,
  supplier_order_id        uuid          null references public.supplier_orders(id) on delete set null,
  type                     text          not null check (type in ('in', 'out', 'adjustment')),
  reason                   text          not null check (reason in ('supplier', 'sale', 'return', 'loss', 'manual', 'correction')),
  quantity                 integer       not null check (quantity > 0),
  previous_stock           integer       not null,
  new_stock                integer       not null,
  unit_cost                numeric(12,2) null,
  notes                    text          null,
  created_by               uuid          not null references auth.users(id),
  created_at               timestamptz   not null default now()
);

create index stock_movements_ep_idx    on public.stock_movements (establishment_product_id);
create index stock_movements_order_idx on public.stock_movements (supplier_order_id);

alter table public.stock_movements enable row level security;

create policy "Miembros ven movimientos de su establecimiento"
  on public.stock_movements for select
  using (
    exists (
      select 1 from public.establishment_products ep
      join public.profiles p on p.establishment_id = ep.establishment_id
      where ep.id = stock_movements.establishment_product_id
        and p.id = auth.uid()
    )
  );

create policy "Owner y empleados crean movimientos"
  on public.stock_movements for insert
  with check (
    exists (
      select 1 from public.establishment_products ep
      join public.profiles p on p.establishment_id = ep.establishment_id
      where ep.id = stock_movements.establishment_product_id
        and p.id = auth.uid()
        and p.role in ('owner', 'employee')
    )
  );


-- ─── 4. Trigger: actualiza stock al insertar un movimiento ───
create or replace function public.process_stock_movement()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.type = 'in' then
    update public.establishment_products
    set stock = stock + new.quantity
    where id = new.establishment_product_id;

  elsif new.type = 'out' then
    update public.establishment_products
    set stock = greatest(0, stock - new.quantity)
    where id = new.establishment_product_id;

  elsif new.type = 'adjustment' then
    -- Para adjustment, quantity se ignora; se usa new_stock directamente
    update public.establishment_products
    set stock = new.new_stock
    where id = new.establishment_product_id;
  end if;

  return new;
end;
$$;

create trigger stock_movement_after_insert
  after insert on public.stock_movements
  for each row execute function public.process_stock_movement();


-- ─── 5. RPC: confirma un ingreso de mercadería atómicamente ──
-- Crea supplier_order + todos los stock_movements en una transacción.
-- Retorna el resumen del ingreso.

create or replace function public.confirm_supplier_order(
  p_establishment_id uuid,
  p_supplier_id      uuid,    -- puede ser null
  p_created_by       uuid,
  p_notes            text,
  p_items            jsonb    -- [{ep_id, quantity, unit_cost}]
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order_id  uuid;
  v_item      jsonb;
  v_ep        record;
  v_movements jsonb := '[]'::jsonb;
  v_qty       integer;
  v_cost      numeric;
begin
  -- Validar que hay items
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Debe haber al menos un producto en el ingreso';
  end if;

  -- Crear la orden
  insert into public.supplier_orders (
    establishment_id, supplier_id, created_by,
    notes, total_items, status
  )
  values (
    p_establishment_id,
    p_supplier_id,
    p_created_by,
    p_notes,
    jsonb_array_length(p_items),
    'confirmed'
  )
  returning id into v_order_id;

  -- Procesar cada item
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := (v_item->>'quantity')::integer;
    v_cost := case
      when v_item->>'unit_cost' is not null and v_item->>'unit_cost' != 'null'
      then (v_item->>'unit_cost')::numeric
      else null
    end;

    -- Leer stock actual
    select * into v_ep
    from public.establishment_products
    where id = (v_item->>'ep_id')::uuid
      and establishment_id = p_establishment_id;

    if not found then
      raise exception 'Producto no encontrado en el establecimiento: %', v_item->>'ep_id';
    end if;

    -- Insertar movimiento (el trigger actualiza el stock)
    insert into public.stock_movements (
      establishment_product_id, supplier_order_id,
      type, reason,
      quantity, previous_stock, new_stock,
      unit_cost, created_by
    ) values (
      v_ep.id, v_order_id,
      'in', 'supplier',
      v_qty, v_ep.stock, v_ep.stock + v_qty,
      v_cost, p_created_by
    );

    v_movements := v_movements || jsonb_build_object(
      'ep_id',          v_ep.id,
      'product_id',     v_ep.product_id,
      'previous_stock', v_ep.stock,
      'new_stock',      v_ep.stock + v_qty,
      'quantity',       v_qty
    );
  end loop;

  return jsonb_build_object(
    'order_id',   v_order_id,
    'movements',  v_movements,
    'total_items', jsonb_array_length(p_items)
  );
end;
$$;


-- ─── 6. Proveedores de ejemplo ───────────────────────────────
-- Descomentar y ajustar el establishment_id luego de crear el establecimiento:
--
-- insert into public.suppliers (establishment_id, name, phone) values
--   ('ESTABLISHMENT-UUID', 'Distribuidora Norte', '011-4444-5555'),
--   ('ESTABLISHMENT-UUID', 'Mayorista Sur',       '011-3333-2222');
