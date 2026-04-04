-- ═══════════════════════════════════════════════════════════════
-- Migration : Images supplémentaires par fiche KB
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS extra_image_urls JSONB DEFAULT '[]'::jsonb;
