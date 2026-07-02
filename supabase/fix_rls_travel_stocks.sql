-- Permitir que cualquier miembro del establecimiento lea sus travel_stocks
-- (dueños, empleados, cajeros — todos del mismo establishment_id)

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
