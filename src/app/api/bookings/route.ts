import { createApiClient, successResponse, errorResponse, getAuthUser } from '@/lib/api-utils'

type BookingRow = {
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
    location: string | null
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

export async function GET() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    try {
        // Get user's agents
        const { data: agents } = await supabase
            .from('agents')
            .select('id')
            .eq('user_id', user.id)

        const agentIds = agents?.map((a: { id: string }) => a.id) || []

        if (agentIds.length === 0) {
            return successResponse({ bookings: [] })
        }

        // Get bookings for user's agents
        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select(`
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
                location,
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
            `)
            .in('agent_id', agentIds)
            .order('created_at', { ascending: false })
            .limit(100)

        if (bookingsError) {
            console.error('Error fetching bookings:', bookingsError)
            return errorResponse('Erreur lors de la récupération des réservations')
        }

        const normalizedBookings = ((bookings || []) as BookingRow[]).map(booking => ({
            ...booking,
            items_count: booking.booking_items?.length || 0,
            booking_items: undefined
        }))

        return successResponse({ bookings: normalizedBookings })
    } catch (err) {
        console.error('Bookings fetch error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
