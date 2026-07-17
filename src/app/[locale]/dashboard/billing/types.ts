export interface Plan {
    id: string
    name: string
    price: number
    credits: number
    features: string[]
    is_popular: boolean
}

export interface CreditPack {
    id: string
    name?: string
    credits: number
    price: number
    savings: number
}

export interface UserData {
    plan: string
    credits_balance: number
    credits_used_this_month: number
    subscription_end: string | null
}

export interface Payment {
    id: string
    amount_fcfa: number
    description: string
    status: string
    payment_provider?: string | null
    payment_channel?: string | null
    payment_channel_detail?: string | null
    reference?: string | null
    credits?: number | null
    created_at: string
    completed_at?: string | null
}

export type SupportedPaymentProvider = 'cinetpay' | 'paystack' | 'feexpay' | 'paydunya'

export type FeexPayPaymentIntent = {
    type: 'subscription' | 'credits'
    targetId: string
}

export const FEEXPAY_CHECKOUT_SESSION_KEY = 'wazzapai_feexpay_checkout_context'
