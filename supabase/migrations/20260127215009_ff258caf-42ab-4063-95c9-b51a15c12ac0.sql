-- Create invoices table for tracking generated invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number SERIAL,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  rental_id UUID REFERENCES public.rentals(id),
  transaction_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ILS',
  description TEXT,
  business_name TEXT NOT NULL DEFAULT 'דיל סלולר',
  business_id TEXT NOT NULL DEFAULT '201512258',
  status TEXT NOT NULL DEFAULT 'issued',
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Authenticated users can manage invoices"
ON public.invoices
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_rental_id ON public.invoices(rental_id);
CREATE INDEX idx_invoices_transaction_id ON public.invoices(transaction_id);