
-- Drop restrictive policies
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.cellstation_sims;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.cellstation_sims;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.cellstation_sims;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.cellstation_sims;

-- Recreate as PERMISSIVE
CREATE POLICY "Allow authenticated read" ON public.cellstation_sims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON public.cellstation_sims FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.cellstation_sims FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON public.cellstation_sims FOR DELETE TO authenticated USING (true);
