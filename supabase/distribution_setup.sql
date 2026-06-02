-- ============================================================
-- NEGOZIO — Módulo de distribución / viajes
-- Ejecutar DESPUÉS de stock_setup.sql
-- ============================================================

-- ─── 0. Extender reason de stock_movements ───────────────────
DO $$ BEGIN
  ALTER TABLE public.stock_movements
    DROP CONSTRAINT stock_movements_reason_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN (
    'supplier','sale','return','loss','manual','correction',
    'external_sale','travel_stock','travel_return'
  ));


-- ─── 1. Clientes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID          NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  phone            TEXT          NULL,
  locality         TEXT          NULL,
  notes            TEXT          NULL,
  total_debt       NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX customers_establishment_idx ON public.customers (establishment_id);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select"
  ON public.customers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.establishment_id = customers.establishment_id)
  );

CREATE POLICY "customers_write"
  ON public.customers FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.establishment_id = customers.establishment_id
              AND p.role IN ('owner','employee'))
  );


-- ─── 2. Viajes (stocks de viaje) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.travel_stocks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID        NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  assigned_to      UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','completed','cancelled')),
  notes            TEXT        NULL,
  created_by       UUID        NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER travel_stocks_updated_at
  BEFORE UPDATE ON public.travel_stocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.travel_stocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_stocks_all"
  ON public.travel_stocks FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.establishment_id = travel_stocks.establishment_id)
  );


-- ─── 3. Items del viaje ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.travel_stock_items (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_stock_id          UUID          NOT NULL REFERENCES public.travel_stocks(id) ON DELETE CASCADE,
  establishment_product_id UUID          NOT NULL REFERENCES public.establishment_products(id),
  product_name             TEXT          NOT NULL,
  quantity_assigned        INTEGER       NOT NULL CHECK (quantity_assigned > 0),
  quantity_sold            INTEGER       NOT NULL DEFAULT 0,
  unit_price               NUMERIC(12,2) NOT NULL,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (travel_stock_id, establishment_product_id)
);

ALTER TABLE public.travel_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_items_all"
  ON public.travel_stock_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.travel_stocks ts
      JOIN public.profiles p ON p.establishment_id = ts.establishment_id
      WHERE ts.id = travel_stock_items.travel_stock_id
        AND p.id = auth.uid()
    )
  );


-- ─── 4. Entregas a clientes ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deliveries (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID          NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  travel_stock_id  UUID          NULL REFERENCES public.travel_stocks(id) ON DELETE SET NULL,
  customer_id      UUID          NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  sold_by          UUID          NOT NULL REFERENCES auth.users(id),
  payment_status   TEXT          NOT NULL DEFAULT 'paid'
                     CHECK (payment_status IN ('paid','pending')),
  total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at          TIMESTAMPTZ   NULL,
  notes            TEXT          NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX deliveries_establishment_idx ON public.deliveries (establishment_id);
CREATE INDEX deliveries_customer_idx      ON public.deliveries (customer_id);
CREATE INDEX deliveries_pending_idx       ON public.deliveries (establishment_id, payment_status);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliveries_all"
  ON public.deliveries FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.establishment_id = deliveries.establishment_id)
  );


-- ─── 5. Items de entrega ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_items (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id              UUID          NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  establishment_product_id UUID          NULL REFERENCES public.establishment_products(id) ON DELETE SET NULL,
  product_name             TEXT          NOT NULL,
  quantity                 INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price               NUMERIC(12,2) NOT NULL,
  subtotal                 NUMERIC(12,2) NOT NULL
);

ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_items_all"
  ON public.delivery_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.profiles p ON p.establishment_id = d.establishment_id
      WHERE d.id = delivery_items.delivery_id
        AND p.id = auth.uid()
    )
  );


-- ─── 6. RPC: crear viaje y descontar stock ────────────────────
CREATE OR REPLACE FUNCTION public.confirm_travel_stock(
  p_establishment_id UUID,
  p_name             TEXT,
  p_assigned_to      UUID,
  p_notes            TEXT,
  p_created_by       UUID,
  p_items            JSONB  -- [{ep_id, name, quantity, unit_price}]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ts_id UUID;
  v_item  JSONB;
  v_ep    RECORD;
  v_qty   INTEGER;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El viaje debe tener al menos un producto';
  END IF;

  -- Validar stock antes de cualquier insert
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    SELECT * INTO v_ep FROM public.establishment_products
    WHERE id = (v_item->>'ep_id')::UUID AND establishment_id = p_establishment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado: %', v_item->>'name';
    END IF;
    IF v_ep.stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para "%": hay % y se quieren llevar %',
        v_item->>'name', v_ep.stock, v_qty;
    END IF;
  END LOOP;

  -- Crear viaje
  INSERT INTO public.travel_stocks(establishment_id, name, assigned_to, notes, created_by, status)
  VALUES(p_establishment_id, p_name, p_assigned_to, p_notes, p_created_by, 'active')
  RETURNING id INTO v_ts_id;

  -- Items + descontar stock principal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    SELECT * INTO v_ep FROM public.establishment_products
    WHERE id = (v_item->>'ep_id')::UUID;

    INSERT INTO public.travel_stock_items(
      travel_stock_id, establishment_product_id, product_name,
      quantity_assigned, quantity_sold, unit_price
    ) VALUES(
      v_ts_id, v_ep.id, v_item->>'name',
      v_qty, 0, (v_item->>'unit_price')::NUMERIC
    );

    INSERT INTO public.stock_movements(
      establishment_product_id, type, reason,
      quantity, previous_stock, new_stock, created_by
    ) VALUES(
      v_ep.id, 'out', 'travel_stock',
      v_qty, v_ep.stock, v_ep.stock - v_qty, p_created_by
    );
  END LOOP;

  RETURN jsonb_build_object('travel_stock_id', v_ts_id);
END;
$$;


-- ─── 7. RPC: registrar entrega a cliente ─────────────────────
CREATE OR REPLACE FUNCTION public.create_delivery(
  p_establishment_id UUID,
  p_travel_stock_id  UUID,
  p_customer_id      UUID,
  p_sold_by          UUID,
  p_payment_status   TEXT,
  p_notes            TEXT,
  p_items            JSONB  -- [{ep_id, name, quantity, unit_price}]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_delivery_id UUID;
  v_item        JSONB;
  v_total       NUMERIC := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total + (v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::INTEGER;
  END LOOP;

  INSERT INTO public.deliveries(
    establishment_id, travel_stock_id, customer_id, sold_by,
    payment_status, total_amount, notes,
    paid_at
  ) VALUES(
    p_establishment_id, p_travel_stock_id, p_customer_id, p_sold_by,
    p_payment_status, v_total, p_notes,
    CASE WHEN p_payment_status = 'paid' THEN NOW() ELSE NULL END
  ) RETURNING id INTO v_delivery_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.delivery_items(
      delivery_id, establishment_product_id, product_name,
      quantity, unit_price, subtotal
    ) VALUES(
      v_delivery_id,
      CASE WHEN (v_item->>'ep_id') IS NOT NULL
           THEN (v_item->>'ep_id')::UUID ELSE NULL END,
      v_item->>'name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC * (v_item->>'quantity')::INTEGER
    );

    -- Actualizar vendido en travel_stock_items
    IF p_travel_stock_id IS NOT NULL AND (v_item->>'ep_id') IS NOT NULL THEN
      UPDATE public.travel_stock_items
      SET quantity_sold = quantity_sold + (v_item->>'quantity')::INTEGER
      WHERE travel_stock_id = p_travel_stock_id
        AND establishment_product_id = (v_item->>'ep_id')::UUID;
    END IF;
  END LOOP;

  -- Acumular deuda del cliente si es fiado
  IF p_payment_status = 'pending' THEN
    UPDATE public.customers
    SET total_debt = total_debt + v_total, updated_at = NOW()
    WHERE id = p_customer_id;
  END IF;

  RETURN jsonb_build_object('delivery_id', v_delivery_id, 'total', v_total);
END;
$$;


-- ─── 8. RPC: marcar entrega como pagada ──────────────────────
CREATE OR REPLACE FUNCTION public.mark_delivery_paid(p_delivery_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_d RECORD;
BEGIN
  SELECT * INTO v_d FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND OR v_d.payment_status = 'paid' THEN RETURN FALSE; END IF;

  UPDATE public.deliveries
  SET payment_status = 'paid', paid_at = NOW(), updated_at = NOW()
  WHERE id = p_delivery_id;

  UPDATE public.customers
  SET total_debt = GREATEST(0, total_debt - v_d.total_amount), updated_at = NOW()
  WHERE id = v_d.customer_id;

  RETURN TRUE;
END;
$$;


-- ─── 9. RPC: devolver sobrantes al cerrar viaje ───────────────
CREATE OR REPLACE FUNCTION public.close_travel_stock(
  p_travel_stock_id UUID,
  p_closed_by       UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item   RECORD;
  v_remain INTEGER;
  v_ep     RECORD;
BEGIN
  -- Devolver sobrantes al stock principal
  FOR v_item IN
    SELECT * FROM public.travel_stock_items WHERE travel_stock_id = p_travel_stock_id
  LOOP
    v_remain := v_item.quantity_assigned - v_item.quantity_sold;
    IF v_remain > 0 THEN
      SELECT * INTO v_ep FROM public.establishment_products
      WHERE id = v_item.establishment_product_id;

      INSERT INTO public.stock_movements(
        establishment_product_id, type, reason,
        quantity, previous_stock, new_stock, created_by
      ) VALUES(
        v_item.establishment_product_id, 'in', 'travel_return',
        v_remain, v_ep.stock, v_ep.stock + v_remain, p_closed_by
      );
    END IF;
  END LOOP;

  UPDATE public.travel_stocks
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_travel_stock_id;

  RETURN jsonb_build_object('closed', TRUE);
END;
$$;
