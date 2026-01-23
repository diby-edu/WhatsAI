-- Migration: Add end_date column for STAY/RENTAL bookings
-- Date: 2026-01-23
-- Purpose: Support check-out dates for hotels and return dates for rentals

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add documentation comment
COMMENT ON COLUMN public.bookings.end_date IS 'Date de fin pour les séjours (STAY) et locations (RENTAL)';
