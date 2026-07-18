export interface Order {
    id: string
    order_number: string
    customer_name: string | null
    customer_phone: string
    status: string
    total_fcfa: number
    payment_method: 'online' | 'cod' | 'mobile_money_direct' | null
    payment_verification_status: string | null
    payment_screenshot_url: string | null
    fulfillment_mode?: 'takeaway' | 'delivery' | null
    pickup_at?: string | null
    deposit_required?: boolean | null
    deposit_amount_fcfa?: number | null
    deposit_status?: string | null
    transaction_id?: string | null
    created_at: string
    items_count: number
    items?: {
        product_name?: string
        product?: {
            product_type: string
        }
    }[]
}

export interface Booking {
    id: string
    customer_name: string | null
    customer_phone: string
    booking_type: string
    service_name: string | null
    status: string
    start_time: string | null
    party_size: number
    location: string | null
    notes: string | null
    price_fcfa: number
    created_at: string
    booking_source?: string | null
    fulfillment_mode?: string | null
    payment_method?: string | null
    deposit_required?: boolean | null
    deposit_amount_fcfa?: number | null
    deposit_status?: string | null
    transaction_id?: string | null
    provider_payment_url?: string | null
    items_count?: number
}
