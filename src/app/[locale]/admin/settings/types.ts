export interface AdminNotificationSettings {
    // Legacy fields (for backwards compatibility)
    notif_new_user: boolean
    notif_plan_upgrade: boolean
    notif_plan_downgrade: boolean
    notif_payment_received: boolean
    notif_payment_failed: boolean
    notif_subscription_cancelled: boolean
    notif_agent_created: boolean
    notif_agent_connected: boolean
    notif_agent_disconnected: boolean
    notif_agent_quota_exceeded: boolean
    notif_openai_error: boolean
    notif_whatsapp_down: boolean
    notif_high_error_rate: boolean
    notif_new_conversation: boolean
    notif_new_order: boolean
    notif_escalation: boolean
    // Email notifications
    email_new_user: boolean
    email_plan_upgrade: boolean
    email_plan_downgrade: boolean
    email_payment_received: boolean
    email_payment_failed: boolean
    email_subscription_cancelled: boolean
    email_agent_created: boolean
    email_agent_connected: boolean
    email_agent_disconnected: boolean
    email_agent_quota_exceeded: boolean
    email_openai_error: boolean
    email_whatsapp_down: boolean
    email_high_error_rate: boolean
    email_new_conversation: boolean
    email_new_order: boolean
    email_escalation: boolean
    // Push notifications (in-app)
    push_new_user: boolean
    push_plan_upgrade: boolean
    push_plan_downgrade: boolean
    push_payment_received: boolean
    push_payment_failed: boolean
    push_subscription_cancelled: boolean
    push_agent_created: boolean
    push_agent_connected: boolean
    push_agent_disconnected: boolean
    push_agent_quota_exceeded: boolean
    push_openai_error: boolean
    push_whatsapp_down: boolean
    push_high_error_rate: boolean
    push_new_conversation: boolean
    push_new_order: boolean
    push_escalation: boolean
}

export interface PaymentProviderReadiness {
    provider: 'cinetpay' | 'paystack' | 'feexpay' | 'paydunya'
    ready: boolean
    requiredKeys: string[]
    missingKeys: string[]
    warnings: string[]
}

export interface AdminSettings {
    // General
    appName: string
    appDescription: string
    maintenanceMode: boolean
    allowRegistrations: boolean
    defaultCredits: number

    // AI
    openaiModel: string
    maxTokensPerMessage: number
    temperatureDefault: number
    maxAgentsFree: number
    maxAgentsStarter: number
    maxAgentsPro: number
    maxAgentsBusiness: number

    // Payment
    cinetpayMode: string
    cinetpaySiteId: string
    defaultPaymentProvider: string
    currency: string
    defaultCommissionRate: number

    // Email
    emailNotifications: boolean
    smtpHost: string
    smtpPort: number
    smtpUser: string
    smtpPassword: string
    smtpSecure: boolean

    // Security
    sessionTimeout: number
    maxLoginAttempts: number
    requireEmailVerification: boolean
    enable2FA: boolean

    // Advanced
    logLevel: string
    enableMetrics: boolean
    apiRateLimit: number
}
