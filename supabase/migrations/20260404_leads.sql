-- ═══════════════════════════════════════════════════════════════
-- Migration : Collecte de leads (agents support client)
-- ═══════════════════════════════════════════════════════════════

-- 1. Nouveaux champs sur la table agents
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS lead_collection_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_redirect_message   TEXT,
  ADD COLUMN IF NOT EXISTS lead_collect_fields     JSONB NOT NULL DEFAULT '["name","phone"]'::jsonb;

-- 2. Nouvelle table leads
CREATE TABLE IF NOT EXISTS public.leads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_phone TEXT,
  lead_name      TEXT,
  lead_phone     TEXT,
  lead_email     TEXT,
  interest       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Index
CREATE INDEX IF NOT EXISTS leads_agent_id_idx   ON public.leads(agent_id);
CREATE INDEX IF NOT EXISTS leads_user_id_idx    ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads(created_at DESC);

-- 4. RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Les marchands voient uniquement leurs leads
CREATE POLICY "leads_select_own" ON public.leads
  FOR SELECT USING (user_id = auth.uid());

-- Insertion autorisée pour le service_role (IA côté serveur)
CREATE POLICY "leads_insert_service_role" ON public.leads
  FOR INSERT WITH CHECK (true);

-- 5. Grants
GRANT SELECT ON public.leads TO authenticated;
GRANT ALL    ON public.leads TO service_role;

-- 6. Politique Storage bucket images (si pas encore configurée)
-- (À appliquer manuellement dans Supabase Dashboard > Storage > Policies
--  si le bucket "images" n'a pas encore de politique d'écriture)
-- INSERT policy : authenticated users can upload to images bucket
-- SELECT policy : public read
