-- Add WhatsApp status columns for standalone service communication
-- Run this in Supabase SQL Editor

ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'disconnected';

ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS whatsapp_qr_code TEXT;

-- Create index for faster polling
CREATE INDEX IF NOT EXISTS idx_agents_whatsapp_status ON agents(whatsapp_status) WHERE is_active = true;

COMMENT ON COLUMN agents.whatsapp_status IS 'Status of WhatsApp connection: disconnected, connecting, qr_ready, connected';
COMMENT ON COLUMN agents.whatsapp_qr_code IS 'Base64 QR code data URL for WhatsApp connection';
