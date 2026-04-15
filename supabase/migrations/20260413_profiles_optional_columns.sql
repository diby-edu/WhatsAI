-- Add optional profile columns used during subscription finalization
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS credits_frozen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS credits_expire_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS credits_high_usage_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS credits_used_this_month INTEGER DEFAULT 0;
