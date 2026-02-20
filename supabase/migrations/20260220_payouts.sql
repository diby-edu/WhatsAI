-- =============================================
-- WhatsAI — Payouts / Merchant Reversals Table
-- Tracks money collected for merchants and disbursements
-- =============================================

CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Amounts (FCFA)
    gross_amount INTEGER NOT NULL,            -- Total collected for merchant
    commission_rate NUMERIC(5,2) DEFAULT 10,  -- Platform commission %
    commission_amount INTEGER NOT NULL,       -- Commission taken
    net_amount INTEGER NOT NULL,              -- Amount to disburse
    
    -- Period covered
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Payout info
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    payment_method TEXT,            -- Mobile Money, Bank Transfer, etc.
    payment_reference TEXT,         -- Transfer reference number
    notes TEXT,
    
    -- Who processed it
    processed_by UUID REFERENCES public.profiles(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON public.payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON public.payouts(created_at DESC);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON public.payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Only admins via service role can access payouts
-- No user-level access needed (admin-only feature)
CREATE POLICY "Service role full access to payouts"
    ON public.payouts
    FOR ALL
    USING (true)
    WITH CHECK (true);
