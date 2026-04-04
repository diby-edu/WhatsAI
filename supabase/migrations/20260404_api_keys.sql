-- ═══════════════════════════════════════════════════════════════
-- Migration : API Keys publiques Wazzap
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.api_keys (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    key_hash              TEXT NOT NULL UNIQUE,
    key_prefix            TEXT NOT NULL,
    environment           TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
    is_active             BOOLEAN DEFAULT true,
    last_used_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT now(),
    expires_at            TIMESTAMPTZ,
    allowed_agent_ids     UUID[],
    rate_limit_per_minute INT DEFAULT 60,
    metadata              JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id  ON public.api_keys(user_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own api_keys" ON public.api_keys
    FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Migration : Logs d'usage API
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.api_usage_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id   UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agent_id     UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    endpoint     TEXT NOT NULL,
    method       TEXT NOT NULL,
    status_code  INT NOT NULL,
    request_body JSONB,
    response_ms  INT,
    ip_address   TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_key_id  ON public.api_usage_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON public.api_usage_logs(user_id, created_at DESC);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own api_usage_logs" ON public.api_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Migration : Webhooks sortants
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.api_webhooks (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id             UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    url                  TEXT NOT NULL,
    secret               TEXT NOT NULL,
    events               TEXT[] DEFAULT ARRAY['message.received', 'conversation.started'],
    is_active            BOOLEAN DEFAULT true,
    last_delivery_at     TIMESTAMPTZ,
    last_delivery_status INT,
    created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_webhooks_user_id  ON public.api_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_api_webhooks_agent_id ON public.api_webhooks(agent_id);

ALTER TABLE public.api_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own api_webhooks" ON public.api_webhooks
    FOR ALL USING (auth.uid() = user_id);
