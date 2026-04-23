-- Add missing order reminder / feedback tracking columns used by cron jobs.
-- Safe in production: IF NOT EXISTS everywhere.

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_reminder_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMPTZ;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS feedback_requested BOOLEAN DEFAULT FALSE;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS feedback_requested_at TIMESTAMPTZ;

-- Helpful indexes for cron filters.
CREATE INDEX IF NOT EXISTS idx_orders_pending_online_reminder
    ON public.orders (created_at)
    WHERE status = 'pending'
      AND payment_method = 'online'
      AND (payment_reminder_sent IS NULL OR payment_reminder_sent = FALSE);

CREATE INDEX IF NOT EXISTS idx_orders_delivered_feedback_window
    ON public.orders (delivered_at)
    WHERE status = 'delivered'
      AND (feedback_requested IS NULL OR feedback_requested = FALSE);
