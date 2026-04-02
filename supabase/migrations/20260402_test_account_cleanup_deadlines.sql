ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS test_account_cleanup_deadline TIMESTAMPTZ;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS test_account_qualified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_test_account_cleanup_deadline
    ON public.profiles (test_account_cleanup_deadline)
    WHERE test_account_cleanup_deadline IS NOT NULL;

-- Protected roles should never be enrolled in the cleanup campaign.
UPDATE public.profiles p
SET test_account_cleanup_deadline = NULL
WHERE COALESCE(p.role, 'user') IN ('admin', 'superadmin', 'support');

-- Backfill permanently qualified users:
-- - at least one completed payment
-- - or at least one agent that has already gone beyond first pairing
UPDATE public.profiles p
SET
    test_account_qualified_at = COALESCE(p.test_account_qualified_at, NOW()),
    test_account_cleanup_deadline = NULL
WHERE COALESCE(p.role, 'user') NOT IN ('admin', 'superadmin', 'support')
  AND (
    EXISTS (
        SELECT 1
        FROM public.payments pay
        WHERE pay.user_id = p.id
          AND pay.status = 'completed'
    )
    OR EXISTS (
        SELECT 1
        FROM public.agents a
        WHERE a.user_id = p.id
          AND (
              COALESCE(a.whatsapp_ever_connected, false) = true
              OR COALESCE(a.whatsapp_connected, false) = true
              OR a.whatsapp_phone IS NOT NULL
              OR a.whatsapp_status IN ('connected', 'reconnect_required', 'disconnected')
          )
    )
  );

-- Existing free test accounts receive a fresh 7-day grace period from rollout time.
UPDATE public.profiles p
SET test_account_cleanup_deadline = NOW() + INTERVAL '7 days'
WHERE COALESCE(p.plan, 'free') = 'free'
  AND COALESCE(p.role, 'user') NOT IN ('admin', 'superadmin', 'support')
  AND p.test_account_qualified_at IS NULL
  AND p.test_account_cleanup_deadline IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.payments pay
      WHERE pay.user_id = p.id
        AND pay.status = 'completed'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM public.agents a
      WHERE a.user_id = p.id
        AND (
            COALESCE(a.whatsapp_ever_connected, false) = true
            OR COALESCE(a.whatsapp_connected, false) = true
            OR a.whatsapp_phone IS NOT NULL
            OR a.whatsapp_status IN ('connected', 'reconnect_required', 'disconnected')
        )
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, test_account_cleanup_deadline)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NOW() + INTERVAL '7 days'
    );
    RETURN NEW;
END;
$$ language 'plpgsql' security definer;
