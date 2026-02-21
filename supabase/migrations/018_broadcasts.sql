-- Broadcasts table for tracking mass message campaigns
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    recipients_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- Admins can see all broadcasts
CREATE POLICY "Admins can manage all broadcasts" ON public.broadcasts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Users can see their own broadcasts
CREATE POLICY "Users can see own broadcasts" ON public.broadcasts
    FOR SELECT
    USING (user_id = auth.uid());

-- Users can create broadcasts for their agents
CREATE POLICY "Users can create broadcasts for their agents" ON public.broadcasts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.agents
            WHERE agents.id = broadcasts.agent_id AND agents.user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcasts_agent ON public.broadcasts(agent_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_user ON public.broadcasts(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON public.broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON public.broadcasts(created_at DESC);

-- Comment
COMMENT ON TABLE public.broadcasts IS 'Mass message campaigns for WhatsApp';
