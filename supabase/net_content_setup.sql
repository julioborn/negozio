-- ============================================================
-- Agregar campo net_content a products
-- Almacena el contenido neto del producto: "475 g", "1 L", "330 ml"
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna a products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS net_content text null;

-- 2. Recrear la vista para incluir net_content
CREATE OR REPLACE VIEW public.establishment_products_detail
  WITH (security_invoker = true)
AS
SELECT
  ep.id,
  ep.establishment_id,
  ep.product_id,
  ep.price,
  ep.cost_price,
  ep.stock,
  ep.stock_min_alert,
  ep.is_active,
  ep.created_at,
  ep.updated_at,
  p.barcode,
  p.name,
  p.brand,
  p.unit_type,
  p.net_content,
  p.image_url,
  p.category_id,
  pc.name  AS category_name,
  pc.color AS category_color,
  (ep.stock <= ep.stock_min_alert) AS is_low_stock
FROM public.establishment_products ep
JOIN public.products p ON p.id = ep.product_id
LEFT JOIN public.product_categories pc ON pc.id = p.category_id;
