-- ═══════════════════════════════════════════════════════════════
-- Migration : Live Query URL sur les agents
-- ═══════════════════════════════════════════════════════════════
-- Permet à l'agent d'appeler un endpoint externe en temps réel
-- pour récupérer des données dynamiques (stock, statut commande, etc.)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS live_query_url    TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS live_query_secret TEXT DEFAULT NULL;
