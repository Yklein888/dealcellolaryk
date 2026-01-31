-- Create trigger for automatic barcode generation on new inventory items
CREATE OR REPLACE FUNCTION public.generate_inventory_barcode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := 'INV-' || UPPER(LEFT(NEW.id::text, 8));
  END IF;
  RETURN NEW;
END;
$function$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_generate_inventory_barcode ON public.inventory;
CREATE TRIGGER trigger_generate_inventory_barcode
  BEFORE INSERT ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_inventory_barcode();