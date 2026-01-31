-- Add barcode column to inventory table for product scanning
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE;

-- Create index for faster barcode lookups
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode);

-- Create a function to auto-generate barcode on insert
CREATE OR REPLACE FUNCTION generate_inventory_barcode()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.barcode IS NULL THEN
    NEW.barcode := 'INV-' || UPPER(LEFT(NEW.id::text, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate barcode
DROP TRIGGER IF EXISTS trigger_generate_inventory_barcode ON inventory;
CREATE TRIGGER trigger_generate_inventory_barcode
  BEFORE INSERT ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION generate_inventory_barcode();

-- Update existing inventory items with barcodes
UPDATE inventory SET barcode = 'INV-' || UPPER(LEFT(id::text, 8)) WHERE barcode IS NULL;