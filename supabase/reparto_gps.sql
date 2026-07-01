-- ─────────────────────────────────────────────────────────────
-- GPS tracking para repartos
-- Correr en: Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reparto_waypoints (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  travel_stock_id uuid        NOT NULL REFERENCES travel_stocks(id) ON DELETE CASCADE,
  lat             float8      NOT NULL,
  lng             float8      NOT NULL,
  type            text        NOT NULL DEFAULT 'route'
                              CHECK (type IN ('route', 'delivery')),
  customer_name   text,
  total_amount    numeric,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reparto_waypoints_ts_idx ON reparto_waypoints (travel_stock_id, recorded_at);

-- RLS
ALTER TABLE reparto_waypoints ENABLE ROW LEVEL SECURITY;

-- Empleado puede insertar waypoints de su propio reparto
CREATE POLICY "employee_insert_waypoints"
  ON reparto_waypoints FOR INSERT
  WITH CHECK (
    travel_stock_id IN (
      SELECT id FROM travel_stocks WHERE assigned_to = auth.uid()
    )
  );

-- Owner y empleado pueden leer waypoints de su establecimiento
CREATE POLICY "establishment_select_waypoints"
  ON reparto_waypoints FOR SELECT
  USING (
    travel_stock_id IN (
      SELECT id FROM travel_stocks
      WHERE establishment_id IN (
        SELECT establishment_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
