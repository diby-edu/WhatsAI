-- Migration: Add new fields for product wizard
-- Run this in Supabase SQL Editor

-- Add product_type column (product or service)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'product';

-- Add AI instructions for the product
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_instructions TEXT;

-- Add lead fields configuration (JSON array)
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_fields JSONB DEFAULT '[]';

-- Add images array for gallery
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Ensure agent_id column exists with proper reference
ALTER TABLE products ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- Create index for faster queries by agent
CREATE INDEX IF NOT EXISTS idx_products_agent_id ON products(agent_id);

-- Example lead_fields structure:
-- [
--   {"id": "1", "name": "full_name", "label": "Nom complet", "type": "text", "required": true},
--   {"id": "2", "name": "phone", "label": "Téléphone", "type": "tel", "required": true},
--   {"id": "3", "name": "address", "label": "Adresse", "type": "text", "required": false}
-- ]
