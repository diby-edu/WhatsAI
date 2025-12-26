-- =============================================
-- Subscription Plans Table (for admin management)
-- =============================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name TEXT NOT NULL,
    price_fcfa INTEGER NOT NULL DEFAULT 0,
    credits_included INTEGER NOT NULL DEFAULT 100,
    
    features JSONB DEFAULT '[]',
    
    billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add role column to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default plans
INSERT INTO public.subscription_plans (name, price_fcfa, credits_included, features, billing_cycle) VALUES
    ('Gratuit', 0, 100, '["100 crédits offerts", "1 agent", "Support email"]', 'monthly'),
    ('Starter', 5000, 500, '["500 crédits/mois", "2 agents", "Support email", "Statistiques de base"]', 'monthly'),
    ('Pro', 15000, 2000, '["2000 crédits/mois", "5 agents", "Support prioritaire", "Analytics avancés", "Produits illimités"]', 'monthly'),
    ('Business', 45000, 10000, '["10000 crédits/mois", "Agents illimités", "Support téléphonique", "API access", "Formation incluse"]', 'monthly')
ON CONFLICT DO NOTHING;
