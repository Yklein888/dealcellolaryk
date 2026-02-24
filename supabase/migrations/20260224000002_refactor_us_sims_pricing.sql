-- Refactor US SIMs system: Remove price, add packages, simplify pricing
-- Run this after 20260224000001_add_us_sims.sql

-- Add missing fields to us_sims table
ALTER TABLE us_sims ADD COLUMN IF NOT EXISTS sim_number text;
ALTER TABLE us_sims ADD COLUMN IF NOT EXISTS includes_israeli_number boolean DEFAULT false;

-- Rename/standardize package values (if needed)
-- Current packages should be: 'calls_only', 'gb_8', 'unlimited'
-- This is handled in application layer, no DB constraint needed

-- Store US activator WhatsApp contact in app_settings
-- Note: This should be set via application once
INSERT INTO app_settings (key, value)
VALUES ('us_activator_whatsapp', '')
ON CONFLICT (key) DO NOTHING;

-- Update RPCs to match new schema

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

-- Owner: add a new SIM (updated signature - no price, includes_israeli)
CREATE OR REPLACE FUNCTION add_sim_by_token(
  p_token text,
  p_company text,
  p_sim_number text DEFAULT NULL,
  p_package text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_includes_israeli boolean DEFAULT false
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_token text;
BEGIN
  SELECT value INTO v_token FROM app_settings WHERE key = 'us_activator_token';
  IF v_token IS NULL OR v_token != p_token THEN
    RETURN json_build_object('error', 'Invalid token');
  END IF;
  INSERT INTO us_sims (sim_company, sim_number, package, notes, includes_israeli_number)
  VALUES (p_company, p_sim_number, p_package, p_notes, p_includes_israeli);
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

-- Owner: renew a SIM (simplified - no notification params, just includes_israeli)
CREATE OR REPLACE FUNCTION renew_sim_by_token(
  p_id uuid,
  p_token text,
  p_months integer DEFAULT 1,
  p_includes_israeli boolean DEFAULT false
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token text;
  v_new_expiry date;
BEGIN
  SELECT value INTO v_token FROM app_settings WHERE key = 'us_activator_token';
  IF v_token IS NULL OR v_token != p_token THEN
    RETURN json_build_object('error', 'Invalid token');
  END IF;

  -- Calculate new expiry date
  SELECT (expiry_date + (p_months || ' months')::interval)::date INTO v_new_expiry
  FROM us_sims WHERE id = p_id;

  UPDATE us_sims SET
    expiry_date = v_new_expiry,
    includes_israeli_number = p_includes_israeli,
    updated_at = now()
  WHERE id = p_id;

  RETURN json_build_object('success', true, 'new_expiry', v_new_expiry);
END;$$;

-- Ensure anon role can execute all token-based RPCs
GRANT EXECUTE ON FUNCTION get_sims_by_token TO anon;
GRANT EXECUTE ON FUNCTION update_sim_activation TO anon;
GRANT EXECUTE ON FUNCTION add_sim_by_token TO anon;
GRANT EXECUTE ON FUNCTION delete_sim_by_token TO anon;
GRANT EXECUTE ON FUNCTION mark_sim_returned_by_token TO anon;
GRANT EXECUTE ON FUNCTION renew_sim_by_token TO anon;
