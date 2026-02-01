-- Remove device_simple_europe from item_category enum
-- First, we need to check if any data uses this value and handle it

-- Note: In PostgreSQL, you cannot directly remove a value from an enum.
-- The safest approach is to ensure no data uses this value.
-- If there are inventory items with device_simple_europe, they should be handled separately.

-- For now, we'll leave the enum as-is since removing enum values in PostgreSQL
-- requires recreating the entire type and updating all dependent columns.
-- The application code no longer references device_simple_europe, so it won't be used.