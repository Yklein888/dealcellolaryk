-- Add activation tracking columns to sim_cards table
ALTER TABLE public.sim_cards 
ADD COLUMN IF NOT EXISTS activation_status text DEFAULT 'none' CHECK (activation_status IN ('none', 'pending', 'activated', 'failed')),
ADD COLUMN IF NOT EXISTS activation_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS activation_completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS linked_rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS linked_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create index for faster lookups on activation status
CREATE INDEX IF NOT EXISTS idx_sim_cards_activation_status ON public.sim_cards(activation_status);

-- Create index for linked rental lookups
CREATE INDEX IF NOT EXISTS idx_sim_cards_linked_rental ON public.sim_cards(linked_rental_id) WHERE linked_rental_id IS NOT NULL;