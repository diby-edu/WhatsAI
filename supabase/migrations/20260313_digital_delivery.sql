-- Digital product delivery fields
-- Cas 1: digital_content = fixed content (URL or text) sent to all buyers
-- Option A: license_keys = JSONB array of {key, used, order_id} for unique keys per order

ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_content TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS license_keys JSONB DEFAULT NULL;
