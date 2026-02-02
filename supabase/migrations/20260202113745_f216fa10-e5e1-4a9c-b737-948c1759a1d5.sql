-- Add pickup_time column to rentals table
-- This field stores the time the customer picked up the equipment (for devices and modems only)
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS pickup_time TIME;

-- Add comment for documentation
COMMENT ON COLUMN public.rentals.pickup_time IS 'Time when customer picked up the rental (used for devices and modems only)';