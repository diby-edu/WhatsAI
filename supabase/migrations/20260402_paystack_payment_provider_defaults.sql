ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'cinetpay';

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'cinetpay';

UPDATE public.orders
SET payment_provider = 'cinetpay'
WHERE payment_provider IS NULL;

UPDATE public.bookings
SET payment_provider = 'cinetpay'
WHERE payment_provider IS NULL;

ALTER TABLE public.orders
    ALTER COLUMN payment_provider SET DEFAULT 'cinetpay';

ALTER TABLE public.bookings
    ALTER COLUMN payment_provider SET DEFAULT 'cinetpay';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_payment_provider_check'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_payment_provider_check
            CHECK (payment_provider IN ('cinetpay', 'paystack'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_payment_provider_check'
    ) THEN
        ALTER TABLE public.bookings
            ADD CONSTRAINT bookings_payment_provider_check
            CHECK (payment_provider IN ('cinetpay', 'paystack'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider
    ON public.orders(payment_provider);

CREATE INDEX IF NOT EXISTS idx_bookings_payment_provider
    ON public.bookings(payment_provider);
