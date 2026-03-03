-- =============================================
-- Admin Notifications Table
-- Stores platform events to show in the admin bell (in-app notifications)
-- Created: 2026-03-03
-- =============================================

CREATE TABLE IF NOT EXISTS admin_notifications (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    type        TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    message     TEXT        NOT NULL,
    data        JSONB       DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast recent-first queries
CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx
    ON admin_notifications (created_at DESC);

-- Auto-delete old notifications after 90 days (keep table lean)
-- Run via cron or pg_cron if available; otherwise clean up manually
-- DELETE FROM admin_notifications WHERE created_at < NOW() - INTERVAL '90 days';

-- RLS: Only service role can write; admin users can read
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
    ON admin_notifications
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Admins can read"
    ON admin_notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'superadmin')
        )
    );
