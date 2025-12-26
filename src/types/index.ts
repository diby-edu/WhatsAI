// User types
export interface User {
    id: string
    email: string
    full_name: string
    avatar_url?: string
    credits_balance: number
    created_at: string
}

// Organization types
export interface Organization {
    id: string
    owner_id: string
    name: string
    slug: string
    created_at: string
}

// Agent types
export interface Agent {
    id: string
    organization_id: string
    name: string
    description?: string
    personality: string
    system_prompt: string
    whatsapp_number?: string
    whatsapp_connected: boolean
    is_active: boolean
    settings: AgentSettings
    created_at: string
    updated_at: string
}

export interface AgentSettings {
    language: string
    response_delay_ms: number
    max_response_length: number
    enable_emojis: boolean
    enable_appointment_booking: boolean
    calendar_link?: string
}

// Conversation types
export interface Conversation {
    id: string
    agent_id: string
    contact_phone: string
    contact_name?: string
    status: 'active' | 'closed' | 'escalated'
    lead_score?: number
    started_at: string
    last_message_at: string
}

// Message types
export interface Message {
    id: string
    conversation_id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    tokens_used: number
    sent_at: string
}

// Knowledge Base types
export interface KnowledgeBase {
    id: string
    agent_id: string
    title: string
    content: string
    char_count: number
    created_at: string
}

// Subscription & Billing types
export interface Plan {
    id: string
    name: string
    price_monthly: number
    price_annual: number
    agents_limit: number
    whatsapp_limit: number
    credits_monthly: number
    knowledge_chars: number
    features: string[]
}

export interface Subscription {
    id: string
    user_id: string
    plan_id: string
    plan?: Plan
    status: 'active' | 'canceled' | 'past_due' | 'trialing'
    current_period_start: string
    current_period_end: string
}

export interface CreditTransaction {
    id: string
    user_id: string
    amount: number
    type: 'credit' | 'debit' | 'bonus'
    description: string
    created_at: string
}

// API Response types
export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: string
}

// WhatsApp types
export interface WhatsAppSession {
    id: string
    agent_id: string
    phone_number: string
    status: 'connecting' | 'connected' | 'disconnected'
    qr_code?: string
    last_seen: string
}

// Analytics types
export interface AnalyticsData {
    total_conversations: number
    total_messages: number
    avg_response_time: number
    conversion_rate: number
    leads_qualified: number
    appointments_booked: number
}
