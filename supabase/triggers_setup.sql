-- ============================================================
-- NEGOZIO — Triggers adicionales
-- Ejecutar DESPUÉS de products_setup.sql
-- ============================================================


-- ─── 1. Tabla product_price_history ──────────────────────────
create table if not exists public.product_price_history (
  id                       uuid          primary key default gen_random_uuid(),
  establishment_product_id uuid          not null references public.establishment_products(id) on delete cascade,
  old_price                numeric(12,2) not null,
  new_price                numeric(12,2) not null,
  changed_by               uuid          null references auth.users(id) on delete set null,
  changed_at               timestamptz   not null default now()
);

create index price_history_ep_idx on public.product_price_history (establishment_product_id);

alter table public.product_price_history enable row level security;

create policy "Owner ve historial de precios"
  on public.product_price_history for select
  using (
    exists (
      select 1
      from public.establishment_products ep
      join public.profiles p on p.establishment_id = ep.establishment_id
      where ep.id = product_price_history.establishment_product_id
        and p.id = auth.uid()
        and p.role = 'owner'
    )
  );


-- ─── 2. Función + trigger: registrar cambio de precio ────────
create or replace function public.record_price_change()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Solo registrar si el precio efectivamente cambió
  if new.price is distinct from old.price then
    insert into public.product_price_history (
      establishment_product_id,
      old_price,
      new_price,
      changed_by
    ) values (
      new.id,
      old.price,
      new.price,
      -- auth.uid() puede ser null cuando el cambio viene del service role (seed)
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists price_change_history on public.establishment_products;

create trigger price_change_history
  after update on public.establishment_products
  for each row
  execute function public.record_price_change();


-- ─── 3. Verificar trigger de stock ───────────────────────────
-- Para verificar que process_stock_movement funciona:
--
-- 1. Insertar un movimiento:
--    insert into public.stock_movements (
--      establishment_product_id,
--      type, reason, quantity, previous_stock, new_stock, created_by
--    ) values (
--      '<ep_id>', 'in', 'manual', 10, <stock_actual>, <stock_actual + 10>, '<user_id>'
--    );
--
-- 2. Verificar que el stock se actualizó:
--    select stock from public.establishment_products where id = '<ep_id>';
--
-- 3. Para verificar historial de precios:
--    update public.establishment_products set price = 999 where id = '<ep_id>';
--    select * from public.product_price_history where establishment_product_id = '<ep_id>';
