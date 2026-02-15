-- =============================================
-- Notification Log Table (anti-duplicate for cron notifications)
-- =============================================

CREATE TABLE IF NOT EXISTS notification_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by user + type + date
CREATE INDEX IF NOT EXISTS idx_notification_log_user_type 
    ON notification_log(user_id, type, created_at);

-- RLS
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read
CREATE POLICY "Service role full access on notification_log"
    ON notification_log
    FOR ALL
    USING (true)
    WITH CHECK (true);
