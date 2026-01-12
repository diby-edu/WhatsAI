import { createClient } from '@supabase/supabase-js'

// Types for database tables
export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    email: string
                    full_name: string | null
                    avatar_url: string | null
                    phone: string | null
                    company: string | null
                    plan: 'free' | 'starter' | 'pro' | 'business'
                    credits_balance: number
                    credits_used_this_month: number
                    timezone: string
                    language: string
                    currency: string
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>
            }
            agents: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    description: string | null
                    avatar_url: string | null
                    system_prompt: string
                    personality: 'professional' | 'friendly' | 'casual' | 'formal'
                    model: string
                    temperature: number
                    max_tokens: number
                    use_emojis: boolean
                    response_delay_seconds: number
                    language: string
                    whatsapp_connected: boolean
                    whatsapp_phone: string | null
                    whatsapp_session_id: string | null
                    is_active: boolean
                    total_conversations: number
                    total_messages: number
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['public']['Tables']['agents']['Row'], 'id' | 'created_at' | 'updated_at' | 'total_conversations' | 'total_messages'>
                Update: Partial<Database['public']['Tables']['agents']['Insert']>
            }
            whatsapp_sessions: {
                Row: {
                    id: string
                    agent_id: string
                    user_id: string
                    phone_number: string | null
                    session_data: any
                    status: 'connecting' | 'connected' | 'disconnected' | 'banned'
                    last_connected_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['public']['Tables']['whatsapp_sessions']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['whatsapp_sessions']['Insert']>
            }
            conversations: {
                Row: {
                    id: string
                    agent_id: string
                    user_id: string
                    contact_phone: string
                    contact_name: string | null
                    contact_push_name: string | null
                    status: 'active' | 'closed' | 'escalated' | 'spam'
                    is_starred: boolean
                    lead_status: 'new' | 'qualified' | 'contacted' | 'converted' | 'lost' | null
                    lead_score: number
                    last_message_text: string | null
                    last_message_at: string | null
                    unread_count: number
                    metadata: any // JSONB
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['conversations']['Insert']>
            }
            messages: {
                Row: {
                    id: string
                    conversation_id: string
                    agent_id: string
                    role: 'user' | 'assistant' | 'system'
                    content: string
                    whatsapp_message_id: string | null
                    message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact'
                    media_url: string | null
                    tokens_used: number
                    response_time_ms: number | null
                    status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
                    created_at: string
                }
                Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['messages']['Insert']>
            }
            knowledge_base: {
                Row: {
                    id: string
                    agent_id: string
                    user_id: string
                    title: string
                    content: string
                    content_type: 'text' | 'faq' | 'document' | 'url'
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['public']['Tables']['knowledge_base']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['knowledge_base']['Insert']>
            }
            subscriptions: {
                Row: {
                    id: string
                    user_id: string
                    plan: 'starter' | 'pro' | 'business'
                    status: 'active' | 'cancelled' | 'expired' | 'past_due'
                    credits_included: number
                    price_fcfa: number
                    billing_cycle: 'monthly' | 'yearly'
                    current_period_start: string
                    current_period_end: string
                    cancelled_at: string | null
                    payment_provider: string
                    payment_provider_subscription_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
            }
            payments: {
                Row: {
                    id: string
                    user_id: string
                    subscription_id: string | null
                    amount_fcfa: number
                    currency: string
                    payment_type: 'subscription' | 'credits' | 'one_time'
                    credits_purchased: number | null
                    status: 'pending' | 'completed' | 'failed' | 'refunded'
                    payment_provider: string
                    provider_transaction_id: string | null
                    provider_response: any
                    created_at: string
                    completed_at: string | null
                }
                Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>
                Update: Partial<Database['public']['Tables']['payments']['Insert']>
            }
        }
    }
}

// Export types for convenience
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Agent = Database['public']['Tables']['agents']['Row']
export type WhatsAppSession = Database['public']['Tables']['whatsapp_sessions']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type KnowledgeBase = Database['public']['Tables']['knowledge_base']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']

// Insert types
export type AgentInsert = Database['public']['Tables']['agents']['Insert']
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
