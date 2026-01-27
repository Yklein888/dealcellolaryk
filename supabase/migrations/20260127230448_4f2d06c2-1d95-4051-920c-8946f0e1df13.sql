-- Add is_approved column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Approve all existing users so they don't get locked out
UPDATE public.user_roles SET is_approved = true WHERE is_approved = false;

-- Create a table to store pending user details (name, email) before approval
CREATE TABLE IF NOT EXISTS public.pending_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on pending_users
ALTER TABLE public.pending_users ENABLE ROW LEVEL SECURITY;

-- Only admins can view pending users
CREATE POLICY "Admins can view pending users"
ON public.pending_users FOR SELECT
USING (public.is_admin(auth.uid()));

-- Only admins can delete pending users (after approval)
CREATE POLICY "Admins can delete pending users"
ON public.pending_users FOR DELETE
USING (public.is_admin(auth.uid()));

-- Anyone authenticated can insert their own pending user record
CREATE POLICY "Users can insert own pending record"
ON public.pending_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_approved FROM public.user_roles WHERE user_id = _user_id),
    false
  )
$$;