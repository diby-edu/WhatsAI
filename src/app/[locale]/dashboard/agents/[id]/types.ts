import type { AgentPaymentMode } from '@/lib/payments/payment-mode-display'

export interface DeliveryQuartier {
    name: string
    fee: number
}

export interface DeliveryCommune {
    name: string
    fee: number
    quartiers?: DeliveryQuartier[]
}

export interface DeliveryZoneNote {
    fee: number | null
    note: string
}

export interface DeliveryZonesConfig {
    communes: DeliveryCommune[]
    hors_abidjan: DeliveryZoneNote
    international: DeliveryZoneNote
}

export interface AgentFormData {
    name: string
    description: string
    is_active: boolean

    is_online_only: boolean
    business_address: string
    social_links: {
        website: string
        facebook: string
        email: string
    }
    latitude: number | null
    longitude: number | null

    business_hours: { [key: string]: { open: string; close: string; closed: boolean } }

    agent_tone: string
    agent_goal: string
    model: string
    temperature: number
    max_tokens: number
    use_emojis: boolean
    language: string
    enable_voice_responses: boolean
    voice_id: string

    custom_rules: string
    system_prompt: string

    payment_mode: AgentPaymentMode
    mobile_money_orange: string
    mobile_money_mtn: string
    mobile_money_wave: string
    custom_payment_methods: { name: string; details: string }[]
    restaurant_deposit_enabled: boolean
    restaurant_deposit_mode: 'percentage' | 'fixed'
    restaurant_deposit_percentage: number
    restaurant_deposit_fixed_amount_fcfa: number
    delivery_fee_mode: 'none' | 'free' | 'zones'
    delivery_zones: DeliveryZonesConfig
    escalation_phone: string
    agent_context: string
    welcome_message: string

    lead_collection_enabled: boolean
    lead_custom_fields: string[]
    lead_redirect_message: string
    lead_collect_fields: string[]

    fallback_contact_message: string

    live_query_url: string
    live_query_secret: string

    external_sync_reply_message: string
}
