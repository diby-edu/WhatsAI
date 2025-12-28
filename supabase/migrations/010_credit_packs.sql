-- Migration: Create credit_packs table
-- Run this in Supabase SQL Editor

-- Create credit_packs table
CREATE TABLE IF NOT EXISTS credit_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price INTEGER NOT NULL, -- Price in FCFA
    savings INTEGER DEFAULT 0, -- Percentage savings (e.g., 10 for 10%)
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default credit packs
INSERT INTO credit_packs (name, credits, price, savings, display_order) VALUES
    ('Pack 500', 500, 5000, 0, 1),
    ('Pack 1000', 1000, 9000, 10, 2),
    ('Pack 2500', 2500, 20000, 20, 3),
    ('Pack 5000', 5000, 35000, 30, 4);

-- Enable RLS
ALTER TABLE credit_packs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active credit packs
CREATE POLICY "Anyone can read active credit packs" ON credit_packs
    FOR SELECT USING (is_active = true);

-- Allow service role full access
CREATE POLICY "Service role full access on credit_packs" ON credit_packs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
