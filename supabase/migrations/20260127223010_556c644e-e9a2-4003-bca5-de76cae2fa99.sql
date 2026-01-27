-- Add sim_number column to inventory table for storing SIM/ICCID numbers
ALTER TABLE public.inventory ADD COLUMN sim_number text;