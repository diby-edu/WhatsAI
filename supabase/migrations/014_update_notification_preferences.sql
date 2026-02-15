-- Migration: Complete notification preferences system
-- Admin + User notification preferences

-- =============================================
-- ADMIN NOTIFICATION PREFERENCES (nouvelle table)
-- =============================================
CREATE TABLE IF NOT EXISTS admin_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Users & Revenue
    notif_new_user BOOLEAN DEFAULT true,
    notif_plan_upgrade BOOLEAN DEFAULT true,
    notif_plan_downgrade BOOLEAN DEFAULT true,
    notif_payment_received BOOLEAN DEFAULT true,
    notif_payment_failed BOOLEAN DEFAULT true,
    notif_subscription_cancelled BOOLEAN DEFAULT true,

    -- Agents
    notif_agent_created BOOLEAN DEFAULT true,
    notif_agent_connected BOOLEAN DEFAULT true,
    notif_agent_disconnected BOOLEAN DEFAULT true,
    notif_agent_quota_exceeded BOOLEAN DEFAULT true,

    -- System & Health
    notif_openai_error BOOLEAN DEFAULT true,
    notif_whatsapp_down BOOLEAN DEFAULT true,
    notif_high_error_rate BOOLEAN DEFAULT true,

    -- Activity
    notif_new_conversation BOOLEAN DEFAULT false,
    notif_new_order BOOLEAN DEFAULT true,
    notif_escalation BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for admin preferences
CREATE INDEX IF NOT EXISTS idx_admin_notification_preferences_admin_id
ON admin_notification_preferences(admin_id);

-- Enable RLS for admin preferences
ALTER TABLE admin_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage admin notification preferences
CREATE POLICY "Admins can view own notification preferences"
    ON admin_notification_preferences FOR SELECT
    USING (auth.uid() = admin_id);

CREATE POLICY "Admins can insert own notification preferences"
    ON admin_notification_preferences FOR INSERT
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can update own notification preferences"
    ON admin_notification_preferences FOR UPDATE
    USING (auth.uid() = admin_id);

-- Service role full access
CREATE POLICY "Service role full access admin notification preferences"
    ON admin_notification_preferences FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- =============================================
-- EXTEND USER NOTIFICATION PREFERENCES
-- =============================================

-- Add new columns for extended user notifications
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS email_order_cancelled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_escalation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_credits_depleted BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_subscription_expiring BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_stock_out BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_order_cancelled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_escalation BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_credits_depleted BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_subscription_expiring BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_stock_out BOOLEAN DEFAULT true;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE admin_notification_preferences IS 'Super admin notification preferences for system events';
COMMENT ON COLUMN admin_notification_preferences.notif_new_user IS 'Notify when a new user registers';
COMMENT ON COLUMN admin_notification_preferences.notif_plan_upgrade IS 'Notify when a user upgrades their plan';
COMMENT ON COLUMN admin_notification_preferences.notif_payment_failed IS 'Notify when a payment fails (critical)';
COMMENT ON COLUMN admin_notification_preferences.notif_openai_error IS 'Notify when OpenAI API errors occur (critical)';
COMMENT ON COLUMN admin_notification_preferences.notif_whatsapp_down IS 'Notify when WhatsApp service is down (critical)';

COMMENT ON COLUMN notification_preferences.email_order_cancelled IS 'Email when an order is cancelled';
COMMENT ON COLUMN notification_preferences.email_escalation IS 'Email when customer requests human escalation';
COMMENT ON COLUMN notification_preferences.email_credits_depleted IS 'Email when credits reach zero';
COMMENT ON COLUMN notification_preferences.email_subscription_expiring IS 'Email when subscription expires soon';
COMMENT ON COLUMN notification_preferences.email_stock_out IS 'Email when a product is out of stock';
