-- ═══════════════════════════════════════════════════════════════
-- Migration : Ajoute agents.conversation_mode
-- 'structured' (défaut, comportement actuel inchangé pour tous les
-- agents existants) ou 'lead_only' (nouveau : saute le moteur panier
-- déterministe, désactive create_order, capture uniquement un lead
-- en texte libre via capture_lead).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS conversation_mode text NOT NULL DEFAULT 'structured';
