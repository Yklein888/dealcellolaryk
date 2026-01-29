-- Create call_logs table for tracking all outgoing calls
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('rental', 'repair')),
  entity_id UUID NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  call_status TEXT NOT NULL DEFAULT 'pending' CHECK (call_status IN ('pending', 'answered', 'no_answer', 'busy', 'callback')),
  campaign_id TEXT,
  call_type TEXT NOT NULL DEFAULT 'manual' CHECK (call_type IN ('manual', 'automatic')),
  call_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_call_logs_entity ON public.call_logs(entity_type, entity_id);
CREATE INDEX idx_call_logs_campaign ON public.call_logs(campaign_id);
CREATE INDEX idx_call_logs_created ON public.call_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users
CREATE POLICY "Authenticated users can manage call_logs"
ON public.call_logs FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_call_logs_updated_at
BEFORE UPDATE ON public.call_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();