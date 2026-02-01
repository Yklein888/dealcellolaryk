-- Add missing columns to sim_cards table
ALTER TABLE public.sim_cards 
ADD COLUMN IF NOT EXISTS short_number text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update is_rented to be based on is_active (inverse logic for clarity)
COMMENT ON COLUMN public.sim_cards.is_active IS 'True if SIM is active (green background), false if expired (red background)';