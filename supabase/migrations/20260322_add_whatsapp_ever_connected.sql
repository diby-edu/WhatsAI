ALTER TABLE agents
ADD COLUMN IF NOT EXISTS whatsapp_ever_connected BOOLEAN;

ALTER TABLE agents
ALTER COLUMN whatsapp_ever_connected SET DEFAULT false;

UPDATE agents
SET whatsapp_ever_connected = false
WHERE whatsapp_ever_connected IS NULL;

UPDATE agents
SET whatsapp_ever_connected = true
WHERE whatsapp_connected = true
   OR whatsapp_phone IS NOT NULL;

ALTER TABLE agents
ALTER COLUMN whatsapp_ever_connected SET NOT NULL;

COMMENT ON COLUMN agents.whatsapp_ever_connected IS 'Whether WhatsApp has connected successfully at least once for this agent';
