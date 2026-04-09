ALTER TABLE public.orders
    ALTER COLUMN payment_provider DROP DEFAULT;

ALTER TABLE public.bookings
    ALTER COLUMN payment_provider DROP DEFAULT;
