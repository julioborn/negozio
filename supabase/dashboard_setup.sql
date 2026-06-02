-- ============================================================
-- NEGOZIO — Setup vistas del dashboard
-- Ejecutar DESPUÉS de sales_setup.sql y external_sales_setup.sql
-- SAFE TO RE-RUN
-- ============================================================

-- ─── 0. Limpieza de vistas y funciones ───────────────────────
drop view if exists public.v_stock_movements_detail;
drop view if exists public.v_top_products;
drop view if exists public.v_daily_sales;
drop view if exists public.v_current_stock;

drop function if exists public.get_dashboard_stats(uuid, timestamptz, timestamptz);
drop function if exists public.get_top_products_range(uuid, timestamptz, timestamptz, int);


-- ─── 1. Vista: v_current_stock ───────────────────────────────
create view public.v_current_stock
  with (security_invoker = true)
as
select
  ep.id,
  ep.establishment_id,
  ep.product_id,
  p.barcode,
  p.name,
  p.brand,
  p.unit_type,
  p.category_id,
  pc.name        as category_name,
  ep.price,
  ep.cost_price,
  ep.stock,
  ep.stock_min_alert,
  ep.is_active,
  (ep.stock <= ep.stock_min_alert) as is_low_stock,
  ep.updated_at
from public.establishment_products ep
join public.products p on p.id = ep.product_id
left join public.product_categories pc on pc.id = p.category_id
where ep.is_active = true;


-- ─── 2. Vista: v_daily_sales ─────────────────────────────────
create view public.v_daily_sales
  with (security_invoker = true)
as
select
  (s.created_at at time zone 'America/Argentina/Buenos_Aires')::date as sale_date,
  s.establishment_id,
  count(*)                                                             as transaction_count,
  sum(s.total)                                                         as total_amount,
  avg(s.total)                                                         as avg_ticket,
  sum(case when s.payment_method = 'cash'     then s.total else 0 end) as cash_total,
  sum(case when s.payment_method = 'card'     then s.total else 0 end) as card_total,
  sum(case when s.payment_method = 'transfer' then s.total else 0 end) as transfer_total,
  sum(case when s.payment_method not in ('cash','card','transfer')
           then s.total else 0 end)                                    as other_total
from public.sales s
where s.status = 'completed'
group by 1, 2;


-- ─── 3. Vista: v_top_products ────────────────────────────────
-- Basada en stock_movements (siempre existe con schema correcto).
-- Cuenta unidades vendidas por movimientos type='out' reason='sale'/'external_sale'.
create view public.v_top_products
  with (security_invoker = true)
as
select
  ep.establishment_id,
  p.name                       as product_name,
  coalesce(p.barcode, '')      as barcode,
  sum(sm.quantity)::bigint     as total_quantity_sold,
  sum(sm.quantity * ep.price)  as total_revenue,
  count(*)::bigint             as sale_count
from public.stock_movements sm
join public.establishment_products ep on ep.id = sm.establishment_product_id
join public.products p on p.id = ep.product_id
where sm.type = 'out'
  and sm.reason in ('sale', 'external_sale')
group by 1, 2, 3;


-- ─── 4. Vista: v_stock_movements_detail ──────────────────────
create view public.v_stock_movements_detail
  with (security_invoker = true)
as
select
  sm.id,
  sm.establishment_product_id,
  ep.establishment_id,
  p.barcode,
  p.name              as product_name,
  p.brand,
  sm.type,
  sm.reason,
  sm.device_type,
  sm.quantity,
  sm.previous_stock,
  sm.new_stock,
  sm.unit_cost,
  sm.notes,
  sm.supplier_order_id,
  sm.created_by,
  pr.full_name         as created_by_name,
  sm.created_at
from public.stock_movements sm
join public.establishment_products ep on ep.id = sm.establishment_product_id
join public.products p on p.id = ep.product_id
left join public.profiles pr on pr.id = sm.created_by;


-- ─── 5. RPC: get_dashboard_stats ─────────────────────────────
create or replace function public.get_dashboard_stats(
  p_establishment_id uuid,
  p_start_date       timestamptz,
  p_end_date         timestamptz
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_sales   jsonb;
  v_low     int;
begin
  select jsonb_build_object(
    'total_sales',       coalesce(sum(s.total), 0),
    'transaction_count', count(s.id),
    'avg_ticket',        coalesce(avg(s.total), 0),
    'cash_total',        coalesce(sum(case when s.payment_method = 'cash'     then s.total else 0 end), 0),
    'card_total',        coalesce(sum(case when s.payment_method = 'card'     then s.total else 0 end), 0),
    'transfer_total',    coalesce(sum(case when s.payment_method = 'transfer' then s.total else 0 end), 0),
    'other_total',       coalesce(sum(case when s.payment_method not in ('cash','card','transfer') then s.total else 0 end), 0)
  )
  into v_sales
  from public.sales s
  where s.establishment_id = p_establishment_id
    and s.status = 'completed'
    and s.created_at >= p_start_date
    and s.created_at <= p_end_date;

  select count(*) into v_low
  from public.establishment_products ep
  where ep.establishment_id = p_establishment_id
    and ep.stock <= ep.stock_min_alert
    and ep.is_active = true;

  return v_sales || jsonb_build_object('low_stock_count', v_low);
end;
$$;


-- ─── 6. RPC: get_top_products_range ──────────────────────────
create or replace function public.get_top_products_range(
  p_establishment_id uuid,
  p_start_date       timestamptz,
  p_end_date         timestamptz,
  p_limit            int default 10
)
returns table (
  product_name       text,
  barcode            text,
  total_quantity     bigint,
  total_revenue      numeric,
  sale_count         bigint
)
language sql
security definer
as $$
  select
    p.name                       as product_name,
    coalesce(p.barcode, '')      as barcode,
    sum(sm.quantity)::bigint     as total_quantity,
    sum(sm.quantity * ep.price)  as total_revenue,
    count(*)::bigint             as sale_count
  from public.stock_movements sm
  join public.establishment_products ep on ep.id = sm.establishment_product_id
  join public.products p on p.id = ep.product_id
  where ep.establishment_id = p_establishment_id
    and sm.type = 'out'
    and sm.reason in ('sale', 'external_sale')
    and sm.created_at >= p_start_date
    and sm.created_at <= p_end_date
  group by p.name, p.barcode
  order by total_quantity desc
  limit p_limit;
$$;
