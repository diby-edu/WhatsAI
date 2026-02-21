-- Feature Flags table for admin-controlled global settings
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Only admins can manage feature flags
CREATE POLICY "Admins can manage feature flags" ON public.feature_flags
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Insert default feature flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('voice_responses', true, 'Permet aux agents de répondre avec des messages vocaux'),
    ('vision_enabled', true, 'Permet aux agents d''analyser les images envoyées'),
    ('ai_tools_booking', true, 'Active l''outil create_booking pour les réservations'),
    ('ai_tools_orders', true, 'Active l''outil create_order pour les commandes'),
    ('maintenance_mode', false, 'Mode maintenance - désactive tous les bots'),
    ('registrations_open', true, 'Permet les nouvelles inscriptions'),
    ('payments_enabled', true, 'Active les paiements CinetPay')
ON CONFLICT (key) DO NOTHING;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON public.feature_flags(key);

-- Comment
COMMENT ON TABLE public.feature_flags IS 'Global feature flags controlled by admin';
