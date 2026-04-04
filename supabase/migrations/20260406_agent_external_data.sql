-- ═══════════════════════════════════════════════════════════════
-- Migration : Données synchronisées via Data Sync API
-- ═══════════════════════════════════════════════════════════════
-- Cette table stocke les données métier poussées par les plateformes
-- externes (Shopify, WooCommerce, etc.) via POST /api/public/v1/sync.
-- L'agent les utilise comme connaissance lors de ses réponses.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.agent_external_data (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
    data_type   TEXT NOT NULL CHECK (data_type IN ('product', 'customer', 'catalog', 'faq', 'custom')),
    external_id TEXT NOT NULL,  -- ID de l'objet côté système externe (upsert key)
    data        JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, data_type, external_id)
);

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agent_external_data_updated_at'
    ) THEN
        CREATE TRIGGER trg_agent_external_data_updated_at
            BEFORE UPDATE ON public.agent_external_data
            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- Index pour chargement par agent (utilisé dans le handler message)
CREATE INDEX IF NOT EXISTS idx_external_data_agent
    ON public.agent_external_data(agent_id, data_type);

-- RLS
ALTER TABLE public.agent_external_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own external data" ON public.agent_external_data
    FOR ALL USING (auth.uid() = user_id);
