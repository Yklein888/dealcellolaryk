-- Add payment token field to customers table
ALTER TABLE public.customers
ADD COLUMN payment_token TEXT,
ADD COLUMN payment_token_last4 TEXT,
ADD COLUMN payment_token_expiry TEXT,
ADD COLUMN payment_token_updated_at TIMESTAMP WITH TIME ZONE;