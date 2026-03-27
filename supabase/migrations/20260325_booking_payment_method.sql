-- Ajoute le mode de paiement sur les reservations de service

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS payment_method TEXT;

COMMENT ON COLUMN public.bookings.payment_method IS 'Mode de paiement choisi pour la reservation: online ou onsite';
