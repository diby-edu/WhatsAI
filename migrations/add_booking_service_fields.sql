-- Migration: Add service booking fields to bookings table
-- Run this in Supabase SQL Editor

-- Add new columns if they don't exist
DO $$ 
BEGIN
    -- service_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'service_name') THEN
        ALTER TABLE bookings ADD COLUMN service_name TEXT;
    END IF;
    
    -- service_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'service_id') THEN
        ALTER TABLE bookings ADD COLUMN service_id UUID REFERENCES products(id);
    END IF;
    
    -- price_fcfa
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'price_fcfa') THEN
        ALTER TABLE bookings ADD COLUMN price_fcfa INTEGER DEFAULT 0;
    END IF;
    
    -- preferred_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'preferred_date') THEN
        ALTER TABLE bookings ADD COLUMN preferred_date DATE;
    END IF;
    
    -- preferred_time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'preferred_time') THEN
        ALTER TABLE bookings ADD COLUMN preferred_time TIME;
    END IF;
    
    -- location
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'location') THEN
        ALTER TABLE bookings ADD COLUMN location TEXT;
    END IF;
    
    -- customer_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'customer_name') THEN
        ALTER TABLE bookings ADD COLUMN customer_name TEXT;
    END IF;
    
    -- conversation_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'conversation_id') THEN
        ALTER TABLE bookings ADD COLUMN conversation_id UUID REFERENCES conversations(id);
    END IF;
    
    -- user_id (if not exists)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'user_id') THEN
        ALTER TABLE bookings ADD COLUMN user_id UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_preferred_date ON bookings(preferred_date);

-- Add RLS policies if not exist
DO $$
BEGIN
    -- Enable RLS
    ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN others THEN NULL;
END $$;
