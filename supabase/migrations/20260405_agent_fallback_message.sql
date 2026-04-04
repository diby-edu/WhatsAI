-- ═══════════════════════════════════════════════════════════════
-- Migration : Message de contact configurable (fallback)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS fallback_contact_message TEXT;
