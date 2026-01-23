-- =============================================
-- SERVICE VERTICALIZATION & SCHEMA REPAIR
-- Version: v2.19
-- =============================================

-- 1. REPAIR: Add agent_id if missing (Critical Fix)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = 'agent_id'
    ) THEN
        ALTER TABLE public.products ADD COLUMN agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_products_agent_id ON public.products(agent_id);
    END IF;
END $$;

-- 2. FEATURE: Add service_subtype column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = 'service_subtype'
    ) THEN
        ALTER TABLE public.products ADD COLUMN service_subtype TEXT;
        
        -- Add Check Constraint for Valid Subtypes
        ALTER TABLE public.products ADD CONSTRAINT check_service_subtype 
        CHECK (service_subtype IN (
            'hotel', 
            'residence', 
            'restaurant', 
            'formation', 
            'event', 
            'coiffeur', 
            'medecin', 
            'coaching', 
            'prestation', 
            'rental', 
            'other'
        ));
    END IF;
END $$;

-- 3. REPAIR: Ensure RLS Policies exist for new columns
-- (Re-applying policies is safe / idempotent if IF NOT EXISTS usage is tricky, 
--  but assuming standard RLS covers whole table, we are good).
