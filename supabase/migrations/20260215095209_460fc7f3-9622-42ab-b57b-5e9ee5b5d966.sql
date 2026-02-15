CREATE TABLE IF NOT EXISTS public.cellstation_sims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sim_number TEXT,
  uk_number TEXT,
  il_number TEXT,
  iccid TEXT UNIQUE,
  status TEXT DEFAULT 'available',
  status_detail TEXT DEFAULT 'unknown',
  expiry_date DATE,
  plan TEXT,
  start_date DATE,
  end_date DATE,
  customer_name TEXT,
  note TEXT,
  last_sync TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cellstation_sims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.cellstation_sims
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.cellstation_sims
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON public.cellstation_sims
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete" ON public.cellstation_sims
  FOR DELETE TO authenticated USING (true);