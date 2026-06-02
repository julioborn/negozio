-- ============================================================
-- NEGOZIO — Setup módulo de productos
-- Ejecutar DESPUÉS de setup.sql (que crea profiles y role_permissions)
-- SAFE TO RE-RUN: hace drop+recreate de todas las tablas nuevas.
-- La tabla profiles NO se toca (solo se le agrega una columna).
-- ============================================================


-- ─── 0. Limpieza previa (orden inverso de dependencias) ──────
drop view  if exists public.establishment_products_detail;
drop table if exists public.establishment_products  cascade;
drop table if exists public.products               cascade;
drop table if exists public.product_categories     cascade;

-- Quitar FK de profiles → establishments antes de dropear establishments
alter table if exists public.profiles
  drop column if exists establishment_id;

drop table if exists public.establishments cascade;


-- ─── 1. Tabla establishments ─────────────────────────────────
create table public.establishments (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  address     text        null,
  phone       text        null,
  email       text        null,
  logo_url    text        null,
  tax_id      text        null,
  owner_id    uuid        not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger establishments_updated_at
  before update on public.establishments
  for each row execute function public.set_updated_at();

alter table public.establishments enable row level security;


-- ─── 2. Agregar establishment_id a profiles ──────────────────
-- DEBE ir ANTES de las políticas que referencian esta columna.
alter table public.profiles
  add column establishment_id uuid
    references public.establishments(id) on delete set null;


-- ─── 3. Políticas RLS de establishments ──────────────────────
-- Ahora profiles.establishment_id ya existe, las políticas son válidas.

create policy "Owner gestiona su establecimiento"
  on public.establishments for all
  using (owner_id = auth.uid());

create policy "Miembros ven su establecimiento"
  on public.establishments for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = establishments.id
    )
  );


-- ─── 4. Tabla product_categories ────────────────────────────
create table public.product_categories (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  description text        null,
  color       text        null default '#6366f1',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger product_categories_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

alter table public.product_categories enable row level security;

create policy "Lectura pública de categorías"
  on public.product_categories for select
  to authenticated
  using (true);

create policy "Owner gestiona categorías"
  on public.product_categories for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

insert into public.product_categories (name, slug, color) values
  ('Almacén',       'almacen',       '#f59e0b'),
  ('Bebidas',       'bebidas',       '#3b82f6'),
  ('Lácteos',       'lacteos',       '#8b5cf6'),
  ('Carnes',        'carnes',        '#ef4444'),
  ('Panadería',     'panaderia',     '#f97316'),
  ('Limpieza',      'limpieza',      '#10b981'),
  ('Higiene',       'higiene',       '#06b6d4'),
  ('Golosinas',     'golosinas',     '#ec4899'),
  ('Congelados',    'congelados',    '#14b8a6'),
  ('Verdulería',    'verduleria',    '#84cc16'),
  ('Perfumería',    'perfumeria',    '#a855f7'),
  ('Sin categoría', 'sin-categoria', '#9ca3af')
on conflict (slug) do nothing;


-- ─── 5. Tabla products (catálogo global) ─────────────────────
create table public.products (
  id          uuid        primary key default gen_random_uuid(),
  barcode     text        not null unique,
  name        text        not null,
  brand       text        null,
  category_id uuid        null references public.product_categories(id) on delete set null,
  unit_type   text        not null default 'unit'
                check (unit_type in ('unit', 'kg', 'liter', 'pack', 'gram')),
  image_url   text        null,
  is_active   boolean     not null default true,
  created_by  uuid        null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index products_barcode_idx on public.products (barcode);
create index products_name_idx    on public.products using gin (to_tsvector('spanish', name));

alter table public.products enable row level security;

create policy "Autenticados ven productos activos"
  on public.products for select
  to authenticated
  using (is_active = true);

create policy "Autenticados crean productos"
  on public.products for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Owner edita productos"
  on public.products for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );


-- ─── 6. Tabla establishment_products ────────────────────────
create table public.establishment_products (
  id               uuid          primary key default gen_random_uuid(),
  establishment_id uuid          not null references public.establishments(id) on delete cascade,
  product_id       uuid          not null references public.products(id) on delete cascade,
  price            numeric(12,2) not null default 0 check (price >= 0),
  cost_price       numeric(12,2) null check (cost_price is null or cost_price >= 0),
  stock            integer       not null default 0,
  stock_min_alert  integer       not null default 5 check (stock_min_alert >= 0),
  is_active        boolean       not null default true,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  unique (establishment_id, product_id)
);

create trigger establishment_products_updated_at
  before update on public.establishment_products
  for each row execute function public.set_updated_at();

create index ep_establishment_idx on public.establishment_products (establishment_id);

alter table public.establishment_products enable row level security;

create policy "Miembros ven productos de su establecimiento"
  on public.establishment_products for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = establishment_products.establishment_id
    )
  );

create policy "Owner y empleados agregan productos"
  on public.establishment_products for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = establishment_products.establishment_id
        and p.role in ('owner', 'employee')
    )
  );

create policy "Owner edita productos del establecimiento"
  on public.establishment_products for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.establishment_id = establishment_products.establishment_id
        and p.role = 'owner'
    )
  );


-- ─── 7. Vista establishment_products_detail ──────────────────
create view public.establishment_products_detail
  with (security_invoker = true)
as
select
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
  p.image_url,
  p.category_id,
  pc.name  as category_name,
  pc.color as category_color,
  (ep.stock <= ep.stock_min_alert) as is_low_stock
from public.establishment_products ep
join public.products p on p.id = ep.product_id
left join public.product_categories pc on pc.id = p.category_id;


-- ─── 8. Bucket de imágenes ───────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Eliminar políticas previas de storage si existen (para poder recrearlas)
drop policy if exists "Autenticados leen imágenes"        on storage.objects;
drop policy if exists "Autenticados suben imágenes"       on storage.objects;
drop policy if exists "Autenticados actualizan sus imágenes" on storage.objects;

create policy "Autenticados leen imágenes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'product-images');

create policy "Autenticados suben imágenes"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "Autenticados actualizan sus imágenes"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');


-- ─── 9. Crear establecimiento para el owner ──────────────────
-- Reemplazá el UUID con el de tu usuario y ejecutá por separado:
--
--   insert into public.establishments (name, owner_id)
--   values ('Mi Tienda', '6033badd-9763-478d-8e84-9686b1a0e685');
--
--   update public.profiles
--   set establishment_id = (
--     select id from public.establishments
--     where owner_id = '6033badd-9763-478d-8e84-9686b1a0e685'
--   )
--   where id = '6033badd-9763-478d-8e84-9686b1a0e685';
