-- ── 1. Ver qué hay en travel_stocks (sin RLS, como superuser) ─────────────────
SELECT id, establishment_id, assigned_to, status, created_at
FROM travel_stocks
ORDER BY created_at DESC
LIMIT 10;

-- ── 2. Ver el establishment_id del dueño y del empleado ───────────────────────
SELECT id, full_name, email, role, establishment_id
FROM profiles
ORDER BY role;

-- ── 3. Ver qué políticas RLS existen en travel_stocks ────────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'travel_stocks';

-- ── 4. Ver qué políticas RLS existen en reparto_waypoints ────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'reparto_waypoints';
