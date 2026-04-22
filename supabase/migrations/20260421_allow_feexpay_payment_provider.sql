DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_payment_provider_check'
    ) THEN
        ALTER TABLE public.orders
            DROP CONSTRAINT orders_payment_provider_check;
    END IF;
END $$;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_payment_provider_check
    CHECK (payment_provider IN ('cinetpay', 'paystack', 'feexpay'));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bookings_payment_provider_check'
    ) THEN
        ALTER TABLE public.bookings
            DROP CONSTRAINT bookings_payment_provider_check;
    END IF;
END $$;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_payment_provider_check
    CHECK (payment_provider IN ('cinetpay', 'paystack', 'feexpay'));

