-- Migration: Add missing product columns used by bot and product wizard
-- These columns are referenced in message-handler.ts and the products API

ALTER TABLE products ADD COLUMN IF NOT EXISTS short_pitch TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS marketing_tags TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS related_product_ids UUID[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS content_included JSONB DEFAULT '[]';
