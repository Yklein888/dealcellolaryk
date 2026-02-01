-- Create sim_cards table for CellStation integration
CREATE TABLE public.sim_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_number TEXT,
  israeli_number TEXT,
  sim_number TEXT,
  expiry_date DATE,
  is_rented BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'available',
  package_name TEXT,
  notes TEXT,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sim_cards ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Authenticated users can manage sim_cards"
  ON public.sim_cards FOR ALL
  USING (true) WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_sim_cards_updated_at
  BEFORE UPDATE ON public.sim_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();