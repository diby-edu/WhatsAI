-- Add escalation_phone field to agents table
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agents' AND column_name = 'escalation_phone'
    ) THEN
        ALTER TABLE agents ADD COLUMN escalation_phone TEXT;
        COMMENT ON COLUMN agents.escalation_phone IS 'Phone number to display when escalating to human support';
    END IF;
END $$;
