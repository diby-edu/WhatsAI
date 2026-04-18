ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS account_lifecycle_status TEXT;

ALTER TABLE public.profiles
ALTER COLUMN account_lifecycle_status SET DEFAULT 'inactive';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_account_lifecycle_status_check'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_account_lifecycle_status_check
        CHECK (
            account_lifecycle_status IN (
                'test',
                'paid_active',
                'frozen_grace',
                'inactive'
            )
        );
    END IF;
END $$;

WITH latest_subscription_windows AS (
    SELECT
        user_id,
        MAX(current_period_end) AS latest_paid_until
    FROM public.subscriptions
    GROUP BY user_id
)
UPDATE public.profiles AS p
SET paid_until = s.latest_paid_until
FROM latest_subscription_windows AS s
WHERE p.id = s.user_id
  AND (
      p.paid_until IS NULL
      OR s.latest_paid_until > p.paid_until
  );

WITH latest_credit_windows AS (
    SELECT
        user_id,
        MAX(COALESCE(completed_at, created_at) + INTERVAL '1 month') AS latest_credit_paid_until
    FROM public.payments
    WHERE status = 'completed'
      AND payment_type = 'credits'
    GROUP BY user_id
)
UPDATE public.profiles AS p
SET paid_until = c.latest_credit_paid_until
FROM latest_credit_windows AS c
WHERE p.id = c.user_id
  AND p.paid_until IS NULL;

UPDATE public.profiles
SET grace_until = credits_expire_at
WHERE grace_until IS NULL
  AND credits_expire_at IS NOT NULL;

UPDATE public.profiles
SET account_lifecycle_status = CASE
    WHEN (
        paid_until IS NOT NULL
        AND paid_until > NOW()
    ) THEN 'paid_active'
    WHEN (
        grace_until IS NOT NULL
        AND grace_until > NOW()
    ) THEN 'frozen_grace'
    WHEN (
        test_account_cleanup_deadline IS NOT NULL
        AND test_account_qualified_at IS NULL
        AND (
            paid_until IS NULL
            OR paid_until <= NOW()
        )
        AND (
            grace_until IS NULL
            OR grace_until <= NOW()
        )
    ) THEN 'test'
    ELSE 'inactive'
END
WHERE account_lifecycle_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_paid_until
    ON public.profiles (paid_until)
    WHERE paid_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_grace_until
    ON public.profiles (grace_until)
    WHERE grace_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_account_lifecycle_status
    ON public.profiles (account_lifecycle_status);
