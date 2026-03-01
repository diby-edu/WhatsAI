-- Migration: Refonte Plans & Crédits (2026-03-01)
-- Nouveaux tarifs FCFA, plan Scale, Boost packs

-- =============================================================
-- 1. Ajouter 'scale' aux CHECK constraints
-- =============================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'business', 'scale'));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('starter', 'pro', 'business', 'scale'));

-- =============================================================
-- 2. Mettre à jour les plans existants (prix en FCFA)
-- =============================================================
UPDATE public.subscription_plans SET
  price_fcfa = 0,
  credits_included = 50,
  max_agents = 1,
  max_whatsapp_numbers = 1,
  features = '[]'::jsonb,
  description = 'Pour tester la plateforme',
  is_popular = false
WHERE name ILIKE 'gratuit' OR name ILIKE 'free';

UPDATE public.subscription_plans SET
  price_fcfa = 6900,
  credits_included = 500,
  max_agents = 1,
  max_whatsapp_numbers = 1,
  features = '[]'::jsonb,
  description = '500 crédits · 1 agent · 1 numéro',
  is_popular = false
WHERE name ILIKE 'starter';

UPDATE public.subscription_plans SET
  price_fcfa = 19900,
  credits_included = 2500,
  max_agents = 3,
  max_whatsapp_numbers = 3,
  features = '[]'::jsonb,
  description = '2 500 crédits · 3 agents · 3 numéros',
  is_popular = true
WHERE name ILIKE 'pro';

UPDATE public.subscription_plans SET
  price_fcfa = 54900,
  credits_included = 8000,
  max_agents = 6,
  max_whatsapp_numbers = 6,
  features = '[]'::jsonb,
  description = '8 000 crédits · 6 agents · 6 numéros',
  is_popular = false
WHERE name ILIKE 'business';

-- =============================================================
-- 3. Insérer le plan Scale
-- =============================================================
INSERT INTO public.subscription_plans
  (name, price_fcfa, credits_included, max_agents, max_whatsapp_numbers,
   features, description, is_active, billing_cycle, is_popular)
VALUES
  ('Scale', 129900, 20000, -1, -1,
   '[]'::jsonb, '20 000 crédits · Agents illimités · Numéros illimités',
   true, 'monthly', false)
ON CONFLICT DO NOTHING;

-- =============================================================
-- 4. Remplacer les credit packs par les Boost packs
-- =============================================================
DELETE FROM credit_packs;

INSERT INTO credit_packs (name, credits, price, savings, display_order, is_active) VALUES
  ('Boost Mini',   200,   3000,  0, 1, true),
  ('Boost S',      500,   7000,  7, 2, true),
  ('Boost M',     2000,  25000, 17, 3, true),
  ('Boost L',     5000,  55000, 27, 4, true),
  ('Boost XL',   12000, 110000, 39, 5, true);
