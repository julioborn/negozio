-- ============================================================
-- NEGOZIO — Reparto v2: registro sin impacto en stock principal
-- Ejecutar en el SQL Editor de Supabase antes de deployar el código
-- ============================================================

-- ─── 1. Columna payment_method en deliveries ─────────────────
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payment_method TEXT
  CHECK (payment_method IN ('cash', 'transfer', 'pending_7', 'pending_15'));


-- ─── 2. RPC: crear reparto del día (sin descontar stock) ──────
CREATE OR REPLACE FUNCTION public.create_reparto_stock(
  p_establishment_id UUID,
  p_assigned_to      UUID,
  p_created_by       UUID,
  p_items            JSONB  -- [{ep_id, name, quantity, unit_price}]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ts_id UUID;
  v_item  JSONB;
  v_name  TEXT;
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El reparto debe tener al menos un producto';
  END IF;

  v_name := 'Reparto '
    || TO_CHAR(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY');

  INSERT INTO public.travel_stocks(
    establishment_id, name, assigned_to, notes, created_by, status
  ) VALUES(
    p_establishment_id, v_name, p_assigned_to, NULL, p_created_by, 'active'
  ) RETURNING id INTO v_ts_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.travel_stock_items(
      travel_stock_id, establishment_product_id, product_name,
      quantity_assigned, quantity_sold, unit_price
    ) VALUES(
      v_ts_id,
      (v_item->>'ep_id')::UUID,
      v_item->>'name',
      (v_item->>'quantity')::INTEGER,
      0,
      (v_item->>'unit_price')::NUMERIC
    );
  END LOOP;

  RETURN jsonb_build_object('travel_stock_id', v_ts_id);
END;
$$;


-- ─── 3. RPC: cerrar reparto (sin devolver stock principal) ────
CREATE OR REPLACE FUNCTION public.close_reparto(p_travel_stock_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.travel_stocks
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_travel_stock_id AND status = 'active';
  RETURN FOUND;
END;
$$;


-- ─── 4. Actualizar create_delivery con payment_method ─────────
CREATE OR REPLACE FUNCTION public.create_delivery(
  p_establishment_id UUID,
  p_travel_stock_id  UUID,
  p_customer_id      UUID,
  p_sold_by          UUID,
  p_payment_status   TEXT,
  p_notes            TEXT,
  p_items            JSONB,
  p_payment_method   TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_delivery_id UUID;
  v_item        JSONB;
  v_total       NUMERIC := 0;
  v_pay_status  TEXT;
BEGIN
  -- Derivar payment_status desde payment_method si se provee
  IF p_payment_method IS NOT NULL THEN
    v_pay_status := CASE
      WHEN p_payment_method IN ('cash', 'transfer') THEN 'paid'
      ELSE 'pending'
    END;
  ELSE
    v_pay_status := p_payment_status;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total := v_total
      + (v_item->>'unit_price')::NUMERIC
      * (v_item->>'quantity')::INTEGER;
  END LOOP;

  INSERT INTO public.deliveries(
    establishment_id, travel_stock_id, customer_id, sold_by,
    payment_status, payment_method, total_amount, notes, paid_at
  ) VALUES(
    p_establishment_id, p_travel_stock_id, p_customer_id, p_sold_by,
    v_pay_status, p_payment_method, v_total, p_notes,
    CASE WHEN v_pay_status = 'paid' THEN NOW() ELSE NULL END
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

    IF p_travel_stock_id IS NOT NULL AND (v_item->>'ep_id') IS NOT NULL THEN
      UPDATE public.travel_stock_items
      SET quantity_sold = quantity_sold + (v_item->>'quantity')::INTEGER
      WHERE travel_stock_id = p_travel_stock_id
        AND establishment_product_id = (v_item->>'ep_id')::UUID;
    END IF;
  END LOOP;

  IF v_pay_status = 'pending' THEN
    UPDATE public.customers
    SET total_debt = total_debt + v_total, updated_at = NOW()
    WHERE id = p_customer_id;
  END IF;

  RETURN jsonb_build_object('delivery_id', v_delivery_id, 'total', v_total);
END;
$$;
