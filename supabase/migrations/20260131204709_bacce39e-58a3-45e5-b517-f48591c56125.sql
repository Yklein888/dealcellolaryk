-- Create table for WebAuthn credentials (fingerprint authentication)
CREATE TABLE public.user_webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.user_webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Users can view their own credentials
CREATE POLICY "Users can view own credentials"
  ON public.user_webauthn_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own credentials
CREATE POLICY "Users can insert own credentials"
  ON public.user_webauthn_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own credentials
CREATE POLICY "Users can update own credentials"
  ON public.user_webauthn_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own credentials
CREATE POLICY "Users can delete own credentials"
  ON public.user_webauthn_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_webauthn_user_id ON public.user_webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credential_id ON public.user_webauthn_credentials(credential_id);