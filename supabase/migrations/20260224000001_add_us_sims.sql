-- US SIMs activation system
-- Tracks physical SIM cards sent to US activator
-- Run this on project: hlswvjyegirbhoszrqyo (via Supabase SQL editor)

CREATE TABLE IF NOT EXISTS us_sims (
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

-- Authenticated users: full access to sims
CREATE POLICY "auth_us_sims_all" ON us_sims
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon users can read app_settings (to fetch activator token for token-based RPCs)
CREATE POLICY "anon_read_settings" ON app_settings
  FOR SELECT TO anon USING (true);

-- Authenticated users can also read settings
CREATE POLICY "auth_read_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.us_sims;

-- ── RPCs (all SECURITY DEFINER = run as superuser, validate token server-side) ──

-- Activator: fetch non-returned SIMs by token
CREATE OR REPLACE FUNCTION get_sims_by_token(p_token text)
RETURNS SETOF us_sims LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token text;
BEGIN
  SELECT value INTO v_token FROM app_settings WHERE key = 'us_activator_token';
  IF v_token IS NULL OR v_token != p_token THEN RETURN; END IF;
  RETURN QUERY SELECT * FROM us_sims WHERE status != 'returned' ORDER BY created_at DESC;
END;$$;

-- Activator: fill in local/israeli numbers and expiry
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

-- Owner: add a new SIM
CREATE OR REPLACE FUNCTION add_sim_by_token(
  p_token text,
  p_company text,
  p_package text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token text;
BEGIN
  SELECT value INTO v_token FROM app_settings WHERE key = 'us_activator_token';
  IF v_token IS NULL OR v_token != p_token THEN
    RETURN json_build_object('error', 'Invalid token');
  END IF;
  INSERT INTO us_sims (sim_company, package, notes) VALUES (p_company, p_package, p_notes);
  RETURN json_build_object('success', true);
END;$$;

-- Owner: delete a SIM
CREATE OR REPLACE FUNCTION delete_sim_by_token(p_id uuid, p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token text;
BEGIN
  SELECT value INTO v_token FROM app_settings WHERE key = 'us_activator_token';
  IF v_token IS NULL OR v_token != p_token THEN
    RETURN json_build_object('error', 'Invalid token');
  END IF;
  DELETE FROM us_sims WHERE id = p_id;
  RETURN json_build_object('success', true);
END;$$;

-- Owner: mark a SIM as returned
CREATE OR REPLACE FUNCTION mark_sim_returned_by_token(p_id uuid, p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token text;
BEGIN
  SELECT value INTO v_token FROM app_settings WHERE key = 'us_activator_token';
  IF v_token IS NULL OR v_token != p_token THEN
    RETURN json_build_object('error', 'Invalid token');
  END IF;
  UPDATE us_sims SET status = 'returned', updated_at = now() WHERE id = p_id;
  RETURN json_build_object('success', true);
END;$$;

-- Grant anon role execute on all RPCs (needed for token-based access without login)
GRANT EXECUTE ON FUNCTION get_sims_by_token TO anon;
GRANT EXECUTE ON FUNCTION update_sim_activation TO anon;
GRANT EXECUTE ON FUNCTION add_sim_by_token TO anon;
GRANT EXECUTE ON FUNCTION delete_sim_by_token TO anon;
GRANT EXECUTE ON FUNCTION mark_sim_returned_by_token TO anon;
