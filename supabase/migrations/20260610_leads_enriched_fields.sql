-- ═══════════════════════════════════════════════════════════════
-- Migration : Leads enrichis — champs date/heure/service + custom
-- ═══════════════════════════════════════════════════════════════

-- 1. Nouveaux champs sur leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS preferred_date   TEXT,
  ADD COLUMN IF NOT EXISTS preferred_time   TEXT,
  ADD COLUMN IF NOT EXISTS service_requested TEXT,
  ADD COLUMN IF NOT EXISTS lead_notes       TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields    JSONB;

-- 2. Champs custom configurables sur l'agent
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS lead_custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Index sur custom_fields pour recherches futures
CREATE INDEX IF NOT EXISTS leads_custom_fields_idx ON public.leads USING gin(custom_fields);
