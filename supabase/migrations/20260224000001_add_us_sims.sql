-- US SIMs activation system
-- Tracks physical SIM cards sent to US activator

CREATE TABLE us_sims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sim_company text NOT NULL,
  package text,
  local_number text,
  israeli_number text,
  expiry_date date,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Seed the activator token (only if not already present)
INSERT INTO app_settings (key, value)
VALUES ('us_activator_token', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE us_sims ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_us_sims_all" ON us_sims
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.us_sims;

-- Token-validated RPC for US activator (no login required)
CREATE OR REPLACE FUNCTION get_sims_by_token(p_token text)
RETURNS SETOF us_sims LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token text;
BEGIN
  SELECT value INTO v_token FROM app_settings WHERE key = 'us_activator_token';
  IF v_token IS NULL OR v_token != p_token THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM us_sims WHERE status != 'returned' ORDER BY created_at DESC;
END;$$;

CREATE OR REPLACE FUNCTION update_sim_activation(
  p_id uuid, p_token text,
  p_local text DEFAULT NULL, p_israeli text DEFAULT NULL, p_expiry date DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token text;
BEGIN
  SELECT value INTO v_token FROM app_settings WHERE key = 'us_activator_token';
  IF v_token IS NULL OR v_token != p_token THEN
    RETURN json_build_object('error', 'Invalid token');
  END IF;
  UPDATE us_sims SET
    local_number   = COALESCE(NULLIF(p_local,''), local_number),
    israeli_number = COALESCE(NULLIF(p_israeli,''), israeli_number),
    expiry_date    = COALESCE(p_expiry, expiry_date),
    status = CASE
      WHEN COALESCE(NULLIF(p_local,''), local_number) IS NOT NULL
       AND COALESCE(NULLIF(p_israeli,''), israeli_number) IS NOT NULL
      THEN 'active' ELSE 'activating' END,
    updated_at = now()
  WHERE id = p_id;
  RETURN json_build_object('success', true);
END;$$;
