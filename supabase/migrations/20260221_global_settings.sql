-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Phase 6 — Global Settings & Financial Thresholds
-- ═══════════════════════════════════════════════════════════════

-- 1. Table des paramètres globaux (Key-Value)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Insérer la commission par défaut (10% initialement)
INSERT INTO public.app_settings (key, value)
VALUES ('default_commission_rate', '10')
ON CONFLICT (key) DO NOTHING;

-- 2. Permissions
GRANT ALL ON public.app_settings TO service_role;
GRANT SELECT ON public.app_settings TO authenticated;

-- Commentaire pour documentation
COMMENT ON TABLE public.app_settings IS 'Stockage des configurations globales du système (commissions, seuils, etc.)';
