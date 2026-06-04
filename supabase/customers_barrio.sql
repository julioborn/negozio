-- Agregar campo barrio a customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS barrio text null;
