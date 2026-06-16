-- ═══════════════════════════════════════════════════════════════
-- Migration : Protéger les leads lors de la suppression d'un agent
-- Avant : ON DELETE CASCADE → leads supprimés avec l'agent
-- Après : ON DELETE SET NULL → leads conservés, agent_id = NULL
-- ═══════════════════════════════════════════════════════════════

-- 1. Rendre agent_id nullable sur leads
ALTER TABLE public.leads
  ALTER COLUMN agent_id DROP NOT NULL;

-- 2. Remplacer la FK CASCADE par SET NULL
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_agent_id_fkey;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_agent_id_fkey
  FOREIGN KEY (agent_id)
  REFERENCES public.agents(id)
  ON DELETE SET NULL;
