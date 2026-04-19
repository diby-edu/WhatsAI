-- ═══════════════════════════════════════════════════════════════
-- Migration : Ajouter colonne description à api_webhooks
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.api_webhooks
    ADD COLUMN IF NOT EXISTS description TEXT;
