-- =============================================
-- Extend subscription_plans table with additional fields
-- =============================================

-- Add new columns for better plan management
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS max_agents INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_whatsapp_numbers INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update existing plans with defaults
UPDATE public.subscription_plans SET 
    max_agents = CASE 
        WHEN name = 'Gratuit' THEN 1
        WHEN name = 'Starter' THEN 2
        WHEN name = 'Pro' THEN 5
        WHEN name = 'Business' THEN -1  -- -1 means unlimited
        ELSE 1
    END,
    max_whatsapp_numbers = CASE 
        WHEN name = 'Gratuit' THEN 1
        WHEN name = 'Starter' THEN 1
        WHEN name = 'Pro' THEN 2
        WHEN name = 'Business' THEN 5
        ELSE 1
    END,
    is_popular = CASE WHEN name = 'Pro' THEN true ELSE false END,
    description = CASE 
        WHEN name = 'Gratuit' THEN 'Parfait pour tester'
        WHEN name = 'Starter' THEN 'Parfait pour démarrer'
        WHEN name = 'Pro' THEN 'Le plus populaire'
        WHEN name = 'Business' THEN 'Pour les équipes'
        ELSE ''
    END
WHERE max_agents IS NULL OR is_popular IS NULL;

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to read active plans
CREATE POLICY IF NOT EXISTS "Anyone can read active plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true);

-- Policy to allow admins to manage plans
CREATE POLICY IF NOT EXISTS "Admins can manage plans"
ON public.subscription_plans
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);
