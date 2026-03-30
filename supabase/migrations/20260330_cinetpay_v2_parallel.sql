-- CinetPay v2 parallel rollout metadata
-- Additive only: keeps existing CinetPay v1 flow intact.

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS provider_payment_url TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS provider_notify_token TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_provider_version TEXT DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_orders_provider_notify_token
    ON public.orders(provider_notify_token);

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS provider_notify_token TEXT;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS payment_provider_version TEXT DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_bookings_provider_notify_token
    ON public.bookings(provider_notify_token);
