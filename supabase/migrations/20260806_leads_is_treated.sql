ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_treated boolean NOT NULL DEFAULT false;
