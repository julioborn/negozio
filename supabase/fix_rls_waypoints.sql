-- ── Corregir RLS en reparto_waypoints ─────────────────────────────────────────

ALTER TABLE reparto_waypoints ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores (nombres posibles)
DROP POLICY IF EXISTS "employee insert own waypoints"       ON reparto_waypoints;
DROP POLICY IF EXISTS "establishment select waypoints"      ON reparto_waypoints;
DROP POLICY IF EXISTS "employees can insert"                ON reparto_waypoints;
DROP POLICY IF EXISTS "establishment can select"            ON reparto_waypoints;
DROP POLICY IF EXISTS "Users can insert own waypoints"      ON reparto_waypoints;
DROP POLICY IF EXISTS "Users can select waypoints"          ON reparto_waypoints;

-- INSERT: solo el empleado asignado al reparto puede insertar
CREATE POLICY "employee insert own waypoints"
ON reparto_waypoints FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM travel_stocks
    WHERE id = travel_stock_id
      AND assigned_to = auth.uid()
  )
);

-- SELECT: cualquier miembro del mismo establecimiento puede leer
--         (tanto el dueño como el empleado)
CREATE POLICY "establishment select waypoints"
ON reparto_waypoints FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM travel_stocks ts
    JOIN profiles p ON p.establishment_id = ts.establishment_id
    WHERE ts.id = reparto_waypoints.travel_stock_id
      AND p.id = auth.uid()
  )
);
