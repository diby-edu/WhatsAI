-- =============================================
-- Restaurant fixed deposit mode
-- Add support for fixed-value deposits in FCFA
-- =============================================

ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS restaurant_deposit_mode TEXT DEFAULT 'percentage';

ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS restaurant_deposit_fixed_amount_fcfa INTEGER DEFAULT 0;

UPDATE public.agents
SET restaurant_deposit_mode = 'percentage'
WHERE restaurant_deposit_mode IS NULL;

ALTER TABLE public.agents
    ALTER COLUMN restaurant_deposit_mode SET DEFAULT 'percentage';

ALTER TABLE public.agents
    DROP CONSTRAINT IF EXISTS agents_restaurant_deposit_mode_check;

ALTER TABLE public.agents
    ADD CONSTRAINT agents_restaurant_deposit_mode_check
    CHECK (
        restaurant_deposit_mode IN ('percentage', 'fixed')
    );

ALTER TABLE public.agents
    DROP CONSTRAINT IF EXISTS agents_restaurant_deposit_fixed_amount_fcfa_check;

ALTER TABLE public.agents
    ADD CONSTRAINT agents_restaurant_deposit_fixed_amount_fcfa_check
    CHECK (
        restaurant_deposit_fixed_amount_fcfa >= 0
    );
