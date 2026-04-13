-- WhatsApp mobile pairing code support (additive, QR flow preserved)

ALTER TABLE public.agents
ADD COLUMN IF NOT EXISTS whatsapp_pairing_mode TEXT DEFAULT 'qr',
ADD COLUMN IF NOT EXISTS whatsapp_pairing_phone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_pairing_code TEXT;

UPDATE public.agents
SET whatsapp_pairing_mode = 'qr'
WHERE whatsapp_pairing_mode IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'agents_whatsapp_pairing_mode_check'
    ) THEN
        ALTER TABLE public.agents
        ADD CONSTRAINT agents_whatsapp_pairing_mode_check
        CHECK (whatsapp_pairing_mode IN ('qr', 'pairing_code'));
    END IF;
END$$;

COMMENT ON COLUMN public.agents.whatsapp_pairing_mode IS
    'Preferred WhatsApp pairing mode: qr or pairing_code';
COMMENT ON COLUMN public.agents.whatsapp_pairing_phone IS
    'Phone number (country code included) used to request WhatsApp pairing code';
COMMENT ON COLUMN public.agents.whatsapp_pairing_code IS
    'Latest WhatsApp pairing code generated for mobile linking';
