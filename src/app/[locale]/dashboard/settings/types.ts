export interface Profile {
    id: string
    email: string
    full_name: string
    phone: string
    company: string
    currency?: string
    avatar_url?: string
    phone_verified?: boolean
}

export interface NotificationSettings {
    // Email - Existing
    email_new_conversation: boolean
    email_daily_summary: boolean
    email_low_credits: boolean
    email_new_order: boolean
    email_agent_status_change: boolean
    // Email - Extended
    email_order_cancelled: boolean
    email_escalation: boolean
    email_credits_depleted: boolean
    email_subscription_expiring: boolean
    email_stock_out: boolean
    email_payment_received: boolean
    // Push - Existing
    push_enabled: boolean
    push_new_conversation: boolean
    push_new_order: boolean
    push_low_credits: boolean
    push_agent_status_change: boolean
    // Push - Extended
    push_order_cancelled: boolean
    push_escalation: boolean
    push_credits_depleted: boolean
    push_subscription_expiring: boolean
    push_stock_out: boolean
    push_payment_received: boolean
    push_new_booking: boolean
    // Leads
    push_new_lead: boolean
    email_new_lead: boolean
}
