CREATE TABLE IF NOT EXISTS public.system_deletion_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    email TEXT,
    full_name TEXT,
    plan TEXT,
    role TEXT,
    deletion_reason TEXT NOT NULL CHECK (deletion_reason IN ('expired_test_account', 'expired_paid_grace')),
    deletion_result TEXT NOT NULL CHECK (deletion_result IN ('deleted', 'skipped', 'failed')),
    failure_message TEXT,
    account_lifecycle_status TEXT,
    paid_until TIMESTAMPTZ,
    grace_until TIMESTAMPTZ,
    test_account_cleanup_deadline TIMESTAMPTZ,
    test_account_qualified_at TIMESTAMPTZ,
    related_counts_before JSONB NOT NULL DEFAULT '{}'::jsonb,
    related_counts_after JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_deletion_audit_logs_created_at
    ON public.system_deletion_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_deletion_audit_logs_user_id
    ON public.system_deletion_audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_system_deletion_audit_logs_reason
    ON public.system_deletion_audit_logs (deletion_reason);

CREATE INDEX IF NOT EXISTS idx_system_deletion_audit_logs_result
    ON public.system_deletion_audit_logs (deletion_result);

GRANT ALL ON public.system_deletion_audit_logs TO service_role;

ALTER TABLE public.system_deletion_audit_logs ENABLE ROW LEVEL SECURITY;
