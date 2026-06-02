-- ============================================================
-- NEGOZIO — Setup inicial de base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ─── 1. Función para actualizar updated_at automáticamente ──
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ─── 2. Tabla profiles ──────────────────────────────────────
-- Extiende auth.users con datos del negocio.
-- El id es el mismo UUID que Supabase Auth asigna al usuario.

create table if not exists public.profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  email         text        not null,
  full_name     text        not null default '',
  role          text        not null default 'employee'
                              check (role in ('owner', 'cashier', 'employee')),
  establishment_id uuid     null,
  avatar_url    text        null,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ─── 3. Trigger: crear profile al registrar usuario ─────────
-- Cuando Supabase crea un usuario en auth.users,
-- automáticamente crea su fila en public.profiles.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Eliminar trigger si ya existía para evitar duplicados
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── 4. RLS — Row Level Security en profiles ────────────────
alter table public.profiles enable row level security;

-- Cada usuario ve y edita solo su propio perfil
create policy "Perfil propio: lectura"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Perfil propio: actualización"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- El owner puede leer todos los perfiles
create policy "Owner: lectura de todos los perfiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- El owner puede actualizar cualquier perfil
create policy "Owner: actualización de perfiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- El owner puede insertar nuevos perfiles manualmente
create policy "Owner: inserción de perfiles"
  on public.profiles for insert
  with check (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );


-- ─── 5. Tabla role_permissions (overrides por rol) ──────────
-- Opcional pero usada por checkPermission().
-- Si está vacía, el sistema usa los defaults del código.

create table if not exists public.role_permissions (
  id          uuid        primary key default gen_random_uuid(),
  role        text        not null check (role in ('owner', 'cashier', 'employee')),
  permission  text        not null,
  is_allowed  boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (role, permission)
);

create trigger role_permissions_updated_at
  before update on public.role_permissions
  for each row execute function public.set_updated_at();

alter table public.role_permissions enable row level security;

-- Solo el owner puede gestionar permisos
create policy "Owner: lectura de permisos"
  on public.role_permissions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

create policy "Owner: gestión de permisos"
  on public.role_permissions for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );


-- ─── 6. Crear el primer usuario owner ───────────────────────
-- PASOS:
--   a) Ir a Authentication → Users → Add user
--   b) Ingresar email y contraseña del dueño
--   c) Copiar el UUID del usuario recién creado
--   d) Ejecutar el UPDATE de abajo reemplazando el UUID:

-- update public.profiles
-- set role = 'owner', full_name = 'Tu Nombre'
-- where id = 'PEGAR-UUID-AQUI';


-- ─── 7. (Opcional) Datos de ejemplo para role_permissions ───
-- Descomentar para agregar un override de ejemplo:

-- insert into public.role_permissions (role, permission, is_allowed) values
--   ('cashier', 'sales.cancel', false),   -- cajero no puede cancelar ventas
--   ('employee', 'stock.delete', false);   -- empleado no puede eliminar stock
