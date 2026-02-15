-- Add unique constraint on iccid for upsert support
ALTER TABLE public.cellstation_sims ADD CONSTRAINT cellstation_sims_iccid_unique UNIQUE (iccid);