ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS estimated_total numeric,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric,
  ADD COLUMN IF NOT EXISTS items jsonb,
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS treated_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_notes text,
  ADD COLUMN IF NOT EXISTS location_link text;

CREATE INDEX IF NOT EXISTS leads_conversation_id_idx ON public.leads(conversation_id);
