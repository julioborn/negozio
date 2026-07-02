-- ── Fix RLS: travel_stocks + profiles ────────────────────────────────────────

-- 1. travel_stocks: todos los miembros del establecimiento pueden leer
DROP POLICY IF EXISTS "establishment can select travel_stocks" ON travel_stocks;
DROP POLICY IF EXISTS "owner can select travel_stocks"         ON travel_stocks;
DROP POLICY IF EXISTS "members can select travel_stocks"       ON travel_stocks;

CREATE POLICY "members can select travel_stocks"
ON travel_stocks FOR SELECT
USING (
  establishment_id = (
    SELECT establishment_id FROM profiles WHERE id = auth.uid()
  )
);

-- 2. profiles: miembros del mismo establecimiento pueden verse entre sí
DROP POLICY IF EXISTS "members can select profiles"            ON profiles;
DROP POLICY IF EXISTS "establishment can select profiles"      ON profiles;

CREATE POLICY "members can select profiles"
ON profiles FOR SELECT
USING (
  establishment_id = (
    SELECT establishment_id FROM profiles WHERE id = auth.uid()
  )
);
