ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS new_user_notified_at TIMESTAMPTZ;

-- Backfill existing users to avoid retroactive "new_user" alerts after deployment.
UPDATE public.profiles
SET new_user_notified_at = COALESCE(new_user_notified_at, created_at, NOW())
WHERE new_user_notified_at IS NULL;
