-- =============================================
-- Fix notification_log: allow users to read and manage their own notifications
-- The original migration (015) only granted service_role access,
-- making the dashboard bell permanently empty for all users.
-- =============================================

-- 1. Add `read` column (used by notifications/page.tsx to track read state)
ALTER TABLE notification_log
ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT false;

-- 2. Add RLS policies for authenticated users

-- SELECT: users can read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notification_log;
CREATE POLICY "Users can read own notifications"
    ON notification_log
    FOR SELECT
    USING (auth.uid() = user_id);

-- UPDATE: users can mark their own notifications as read
DROP POLICY IF EXISTS "Users can update own notifications" ON notification_log;
CREATE POLICY "Users can update own notifications"
    ON notification_log
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notification_log;
CREATE POLICY "Users can delete own notifications"
    ON notification_log
    FOR DELETE
    USING (auth.uid() = user_id);
