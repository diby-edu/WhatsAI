-- Migration : support des inscriptions (booking_type = inscription)
-- Phase 4 du plan d'implémentation

-- Ajouter inscription_pending aux statuts valides des réservations
-- (DROP CONSTRAINT + ADD CONSTRAINT car ALTER CONSTRAINT n'existe pas en PostgreSQL)
ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'inscription_pending'));

-- Permettre start_time NULL (pour les inscriptions sans date fixe)
ALTER TABLE public.bookings ALTER COLUMN start_time DROP NOT NULL;

-- Index pour filtrer les inscriptions rapidement
CREATE INDEX IF NOT EXISTS idx_bookings_inscription
    ON public.bookings(agent_id, status)
    WHERE booking_type = 'inscription';
