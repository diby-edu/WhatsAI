-- ═══════════════════════════════════════════════════════════════
-- Migration : Ajout champs localisation et entreprise sur leads
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_location TEXT,
  ADD COLUMN IF NOT EXISTS lead_company  TEXT;
