-- Create an RPC to fetch inventory via a non-"inventory" REST path (helps with adblock/extension filters)
CREATE OR REPLACE FUNCTION public.get_stock_items()
RETURNS SETOF public.inventory
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.inventory
  ORDER BY created_at DESC;
$$;

-- Allow logged-in users to call it
GRANT EXECUTE ON FUNCTION public.get_stock_items() TO authenticated;