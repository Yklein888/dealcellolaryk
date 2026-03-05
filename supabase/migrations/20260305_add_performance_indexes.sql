-- Performance optimization: Add indexes for frequently queried columns
-- These indexes significantly speed up filtering operations (status, created_at, customer_id)

-- Rentals table indexes
CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_customer_id ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_created_at ON rentals(created_at);
CREATE INDEX IF NOT EXISTS idx_rentals_end_date ON rentals(end_date);
CREATE INDEX IF NOT EXISTS idx_rentals_status_created ON rentals(status, created_at DESC);

-- Repairs table indexes
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_created_at ON repairs(created_at);
CREATE INDEX IF NOT EXISTS idx_repairs_rental_id ON repairs(rental_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status_created ON repairs(status, created_at DESC);

-- Inventory table indexes
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_item_category ON inventory(item_category);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_status_category ON inventory(status, item_category);

-- US SIMs table indexes
CREATE INDEX IF NOT EXISTS idx_us_sims_status ON us_sims(status);
CREATE INDEX IF NOT EXISTS idx_us_sims_created_at ON us_sims(created_at);
CREATE INDEX IF NOT EXISTS idx_us_sims_phone ON us_sims(phone);
CREATE INDEX IF NOT EXISTS idx_us_sims_status_created ON us_sims(status, created_at DESC);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Calls table indexes (if it exists)
CREATE INDEX IF NOT EXISTS idx_calls_rental_id ON calls(rental_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);

-- App settings table indexes
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- Composite indexes for common filter + sort patterns
CREATE INDEX IF NOT EXISTS idx_rentals_status_end_date ON rentals(status, end_date DESC);
CREATE INDEX IF NOT EXISTS idx_repairs_status_rental ON repairs(status, rental_id);

-- Analyze tables to update statistics (helps query planner)
ANALYZE rentals;
ANALYZE repairs;
ANALYZE inventory;
ANALYZE us_sims;
ANALYZE customers;
ANALYZE calls;
ANALYZE app_settings;

-- Log migration completion
SELECT 'Performance indexes added successfully' as status;
