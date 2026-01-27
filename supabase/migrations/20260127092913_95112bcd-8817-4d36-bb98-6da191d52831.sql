-- Add overdue charging configuration to rentals
ALTER TABLE public.rentals
ADD COLUMN IF NOT EXISTS overdue_daily_rate numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS overdue_grace_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_charge_enabled boolean DEFAULT false;

-- Add a table to track overdue charges (both successful and pending)
CREATE TABLE IF NOT EXISTS public.overdue_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL REFERENCES public.rentals(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  charge_date date NOT NULL,
  days_overdue integer NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'ILS',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charged', 'failed', 'waived')),
  transaction_id text REFERENCES public.payment_transactions(transaction_id),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.overdue_charges ENABLE ROW LEVEL SECURITY;

-- RLS policy for authenticated users
CREATE POLICY "Authenticated users can manage overdue charges"
  ON public.overdue_charges
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_overdue_charges_rental_id ON public.overdue_charges(rental_id);
CREATE INDEX IF NOT EXISTS idx_overdue_charges_status ON public.overdue_charges(status);
CREATE INDEX IF NOT EXISTS idx_overdue_charges_charge_date ON public.overdue_charges(charge_date);

-- Trigger to update updated_at
CREATE TRIGGER update_overdue_charges_updated_at
  BEFORE UPDATE ON public.overdue_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();