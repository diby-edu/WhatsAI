-- Nouveaux flags : missions agents + types produits
INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('agent_ecommerce',   true,  'Mission E-commerce / Boutique disponible à la création'),
    ('agent_restaurant',  false, 'Mission Restaurant / Fast-food disponible à la création'),
    ('agent_hotel',       false, 'Mission Hôtel / Hébergement disponible à la création'),
    ('agent_salon',       false, 'Mission Salon / Beauté disponible à la création'),
    ('agent_services',    false, 'Mission Services / Artisan disponible à la création'),
    ('agent_custom',      false, 'Mission Personnalisé disponible à la création'),
    ('product_digital',   true,  'Type de produit Numérique disponible à la création'),
    ('product_physical',  false, 'Type de produit Physique disponible à la création'),
    ('product_service',   false, 'Type de produit Service disponible à la création')
ON CONFLICT (key) DO NOTHING;

-- Table feature flags par utilisateur (overrides individuels)
CREATE TABLE IF NOT EXISTS public.user_feature_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    granted_by  UUID REFERENCES public.profiles(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature_key)
);

ALTER TABLE public.user_feature_flags ENABLE ROW LEVEL SECURITY;

-- L'utilisateur peut lire ses propres flags
CREATE POLICY "Users can read own feature flags" ON public.user_feature_flags
    FOR SELECT USING (auth.uid() = user_id);

-- Seuls les admins peuvent gérer les flags utilisateurs
CREATE POLICY "Admins can manage user feature flags" ON public.user_feature_flags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'superadmin')
        )
    );

CREATE INDEX IF NOT EXISTS idx_user_feature_flags_user ON public.user_feature_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feature_flags_key  ON public.user_feature_flags(feature_key);
