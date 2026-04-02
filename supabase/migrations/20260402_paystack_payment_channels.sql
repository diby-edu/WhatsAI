ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS payment_channel TEXT,
    ADD COLUMN IF NOT EXISTS payment_channel_detail TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_payment_channel
    ON public.payments(payment_channel);
