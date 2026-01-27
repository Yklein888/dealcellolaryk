-- ============================================
-- SECURITY MIGRATION: Credit Card Data Protection
-- ============================================

-- 1. Remove the deprecated credit_card column (we now use payment_token from Pelecard)
ALTER TABLE public.customers DROP COLUMN IF EXISTS credit_card;

-- 2. Create a secure customers view that hides sensitive payment tokens
-- Only expose payment_token_last4 for display purposes
CREATE OR REPLACE VIEW public.customers_secure
WITH (security_invoker = on) AS
  SELECT 
    id,
    name,
    phone,
    email,
    address,
    notes,
    payment_token_last4,
    payment_token_expiry,
    payment_token_updated_at,
    created_at,
    updated_at
  FROM public.customers;
  -- Excludes: payment_token (the actual token used for charging)

-- 3. Create a function to check if payment token exists (without exposing the token)
CREATE OR REPLACE FUNCTION public.customer_has_payment_token(customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payment_token IS NOT NULL AND payment_token != ''
  FROM public.customers
  WHERE id = customer_id
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.customer_has_payment_token(uuid) TO authenticated;

-- 4. Create a secure function for edge functions to get token (only for backend use)
CREATE OR REPLACE FUNCTION public.get_customer_payment_token(customer_id uuid)
RETURNS TABLE(
  token text,
  last4 text,
  expiry text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    payment_token,
    payment_token_last4,
    payment_token_expiry
  FROM public.customers
  WHERE id = customer_id
$$;

-- Only service role can use this function (edge functions)
REVOKE ALL ON FUNCTION public.get_customer_payment_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_payment_token(uuid) FROM authenticated;

-- 5. Update RLS policies to be more restrictive
-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all operations on customers" ON public.customers;

-- Create new policies: only authenticated users can access
CREATE POLICY "Authenticated users can view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (true);

-- 6. Add similar RLS improvements to other sensitive tables
DROP POLICY IF EXISTS "Allow all operations on inventory" ON public.inventory;
CREATE POLICY "Authenticated users can manage inventory"
ON public.inventory
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on rentals" ON public.rentals;
CREATE POLICY "Authenticated users can manage rentals"
ON public.rentals
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on rental_items" ON public.rental_items;
CREATE POLICY "Authenticated users can manage rental_items"
ON public.rental_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on repairs" ON public.repairs;
CREATE POLICY "Authenticated users can manage repairs"
ON public.repairs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage invoices" ON public.invoices;
CREATE POLICY "Authenticated users can manage invoices"
ON public.invoices
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage transactions" ON public.payment_transactions;
CREATE POLICY "Authenticated users can manage transactions"
ON public.payment_transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage overdue charges" ON public.overdue_charges;
CREATE POLICY "Authenticated users can manage overdue_charges"
ON public.overdue_charges
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);