import { createApiClient, successResponse, errorResponse, getAuthUser } from '@/lib/api-utils'
import { BookingSelectRow, BOOKING_SELECT_COLUMNS } from '@/lib/bookings/types'

type BookingRow = BookingSelectRow & {
    location: string | null
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
            .select(`${BOOKING_SELECT_COLUMNS}, location`)
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
