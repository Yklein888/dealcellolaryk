-- Create table for tracking user devices
CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  device_name text,
  browser text,
  os text,
  is_approved boolean NOT NULL DEFAULT false,
  last_used_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_fingerprint)
);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Users can view their own devices
CREATE POLICY "Users can view own devices"
ON public.user_devices
FOR SELECT
USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Users can insert their own device (pending approval)
CREATE POLICY "Users can register own device"
ON public.user_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only admins can update devices (approve/reject)
CREATE POLICY "Admins can update devices"
ON public.user_devices
FOR UPDATE
USING (is_admin(auth.uid()));

-- Admins can delete devices
CREATE POLICY "Admins can delete devices"
ON public.user_devices
FOR DELETE
USING (is_admin(auth.uid()));

-- Function to check if device is approved
CREATE OR REPLACE FUNCTION public.is_device_approved(_user_id uuid, _fingerprint text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_approved FROM public.user_devices 
     WHERE user_id = _user_id AND device_fingerprint = _fingerprint),
    false
  )
$$;

-- Function to register device (returns true if new device, false if existing)
CREATE OR REPLACE FUNCTION public.register_device(
  _user_id uuid, 
  _fingerprint text,
  _device_name text DEFAULT NULL,
  _browser text DEFAULT NULL,
  _os text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_device uuid;
BEGIN
  -- Check if device already exists
  SELECT id INTO existing_device 
  FROM public.user_devices 
  WHERE user_id = _user_id AND device_fingerprint = _fingerprint;
  
  IF existing_device IS NOT NULL THEN
    -- Update last used
    UPDATE public.user_devices 
    SET last_used_at = now()
    WHERE id = existing_device;
    RETURN false; -- Not a new device
  ELSE
    -- Insert new device
    INSERT INTO public.user_devices (user_id, device_fingerprint, device_name, browser, os)
    VALUES (_user_id, _fingerprint, _device_name, _browser, _os);
    RETURN true; -- New device registered
  END IF;
END;
$$;