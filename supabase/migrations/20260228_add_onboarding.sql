-- Add onboarding_completed to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Existing users are considered to have already completed onboarding
-- New users will have false by default
UPDATE public.profiles SET onboarding_completed = true
WHERE onboarding_completed = false OR onboarding_completed IS NULL;
