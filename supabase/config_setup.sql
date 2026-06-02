-- ============================================================
-- NEGOZIO — Setup módulo de configuración
-- SAFE TO RE-RUN
-- ============================================================

-- ─── 1. Bucket para logos del establecimiento ────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'establishment-logos',
  'establishment-logos',
  true,
  2097152,  -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "Logos: lectura pública"                    on storage.objects;
drop policy if exists "Logos: owner puede subir"                  on storage.objects;
drop policy if exists "Logos: owner puede actualizar"             on storage.objects;

create policy "Logos: lectura pública"
  on storage.objects for select
  using (bucket_id = 'establishment-logos');

create policy "Logos: owner puede subir"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'establishment-logos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

create policy "Logos: owner puede actualizar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'establishment-logos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner'
    )
  );

-- ─── 2. RLS adicional: owner puede ver todos los perfiles del establecimiento ──
-- (La política base ya existe en setup.sql, este es un complemento para INSERT)
-- Permite al owner insertar perfiles para nuevos usuarios vía admin client

-- El INSERT de perfiles de nuevos usuarios se hace con el admin client (service role)
-- por lo que no necesita política RLS adicional.

-- ─── 3. Política para activar/desactivar usuarios ────────────
-- La política "Owner: actualización de perfiles" ya cubre esto (en setup.sql).
