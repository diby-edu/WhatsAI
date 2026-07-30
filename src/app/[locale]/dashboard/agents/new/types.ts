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

export interface NewAgentFormData {
    name: string
    description: string
    mission: string
    ecommerce_mode: 'native' | 'external_sync'
    systemPrompt: string
    personality: string
    useEmojis: boolean
    responseDelay: number
    language: string
    enableVoice: boolean
    voiceId: string
    is_online_only: boolean
    business_address: string
    escalation_phone: string
    site_url: string
    latitude: string
    longitude: string
    custom_rules: string
    business_hours: { [key: string]: { open: string; close: string; closed: boolean } }
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
    agent_context: string
    welcome_message: string
    lead_collection_enabled: boolean
    lead_redirect_message: string
    lead_collect_fields: string[]
    fallback_contact_message: string
    live_query_url: string
    live_query_secret: string
    external_sync_reply_message: string
}

export interface MissionTemplate {
    id: string
    title: string
    description: string
    prompt: string
}

export interface Personality {
    id: string
    name: string
    emoji: string
    description: string
}
