export interface BookingSelectRow {
    id: string
    customer_name: string | null
    customer_phone: string | null
    booking_type: string
    booking_source: string | null
    service_name: string | null
    status: string
    start_time: string | null
    preferred_date: string | null
    preferred_time: string | null
    party_size: number | null
    notes: string | null
    price_fcfa: number | null
    fulfillment_mode: string | null
    payment_method: string | null
    deposit_required: boolean | null
    deposit_amount_fcfa: number | null
    deposit_status: string | null
    transaction_id: string | null
    provider_payment_url: string | null
    created_at: string
    booking_items?: { id: string }[] | null
}

export const BOOKING_SELECT_COLUMNS = `
    id,
    customer_name,
    customer_phone,
    booking_type,
    booking_source,
    service_name,
    status,
    start_time,
    preferred_date,
    preferred_time,
    party_size,
    notes,
    price_fcfa,
    fulfillment_mode,
    payment_method,
    deposit_required,
    deposit_amount_fcfa,
    deposit_status,
    transaction_id,
    provider_payment_url,
    created_at,
    booking_items(id)
`
