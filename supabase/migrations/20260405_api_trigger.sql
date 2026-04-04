-- ═══════════════════════════════════════════════════════════════
-- Migration : Idempotence API + événements trigger
-- ═══════════════════════════════════════════════════════════════

-- Table pour garantir l'idempotence des appels API
-- Chaque (user_id, idempotency_key) ne peut déclencher qu'un seul envoi
CREATE TABLE IF NOT EXISTS public.api_idempotency (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, idempotency_key)
);

-- Index pour lookup rapide
CREATE INDEX IF NOT EXISTS idx_api_idempotency_lookup
    ON public.api_idempotency(user_id, idempotency_key);

-- RLS : un utilisateur ne voit que ses propres clés d'idempotence
ALTER TABLE public.api_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own idempotency keys" ON public.api_idempotency
    FOR ALL USING (auth.uid() = user_id);
