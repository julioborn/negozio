-- ============================================================
-- NEGOZIO — Fix permisos + Modo Viaje
-- ============================================================

-- ─── 1. RPC set_role_permission (SECURITY DEFINER) ───────────
-- Bypasea RLS para que el owner pueda guardar permisos sin problemas
CREATE OR REPLACE FUNCTION public.set_role_permission(
  p_role       text,
  p_permission text,
  p_is_allowed boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role(auth.uid()) != 'owner' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.role_permissions (role, permission, is_allowed)
  VALUES (p_role, p_permission, p_is_allowed)
  ON CONFLICT (role, permission)
  DO UPDATE SET is_allowed = p_is_allowed, updated_at = NOW();

  RETURN TRUE;
END;
$$;


-- ─── 2. Modo viaje en profiles ────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS travel_mode boolean NOT NULL DEFAULT false;


-- ─── 3. RPC toggle_travel_mode ───────────────────────────────
CREATE OR REPLACE FUNCTION public.set_travel_mode(
  p_user_id    uuid,
  p_travel_mode boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role(auth.uid()) != 'owner' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET travel_mode = p_travel_mode, updated_at = NOW()
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;
