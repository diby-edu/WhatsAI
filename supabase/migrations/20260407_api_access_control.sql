-- ═══════════════════════════════════════════════════════════════
-- Migration : Contrôle d'accès API par utilisateur
-- ═══════════════════════════════════════════════════════════════
-- Par défaut : api_access_enabled = FALSE (accès fermé pendant les tests)
-- L'admin active manuellement les utilisateurs autorisés
-- Le flag global api_public_enabled dans feature_flags permet de tout couper
-- ═══════════════════════════════════════════════════════════════

-- Accès API par utilisateur (false = désactivé par défaut pendant les tests)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS api_access_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Commentaire descriptif
COMMENT ON COLUMN public.profiles.api_access_enabled IS
    'Accès à l''API publique WazzapAI. FALSE par défaut. Activé manuellement par l''admin.';

-- Index pour lookup rapide dans public-auth.ts
CREATE INDEX IF NOT EXISTS idx_profiles_api_access
    ON public.profiles(id, api_access_enabled);

-- ═══════════════════════════════════════════════════════════════
-- Insérer le feature flag global dans feature_flags (si la table existe)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.feature_flags (key, enabled)
VALUES ('api_public_enabled', false)
ON CONFLICT (key) DO NOTHING;
