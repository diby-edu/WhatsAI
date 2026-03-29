import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

type BookingRow = {
    id: string
    customer_phone: string | null
    customer_name: string | null
    booking_type: string
    booking_source: string | null
    service_name: string | null
    status: string
    start_time: string | null
    preferred_date: string | null
    preferred_time: string | null
    party_size: number | null
    price_fcfa: number | null
    fulfillment_mode: string | null
    payment_method: string | null
    deposit_required: boolean | null
    deposit_amount_fcfa: number | null
    deposit_status: string | null
    transaction_id: string | null
    provider_payment_url: string | null
    notes: string | null
    created_at: string
    agent_id: string | null
    booking_items?: { id: string }[] | null
}

type AgentRow = {
    id: string
    name: string | null
    user_id: string | null
}

type OwnerRow = {
    id: string
    full_name: string | null
    email: string | null
}

// GET - List ALL bookings (admin only)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Forbidden - Admin only', 403)
    }

    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const normalizedType = type === 'hotel'
            ? 'stay'
            : type === 'service'
                    ? 'slot'
                    : type

        let query = adminSupabase
            .from('bookings')
            .select(`
                id,
                customer_phone,
                customer_name,
                booking_type,
                booking_source,
                service_name,
                status,
                start_time,
                preferred_date,
                preferred_time,
                party_size,
                price_fcfa,
                fulfillment_mode,
                payment_method,
                deposit_required,
                deposit_amount_fcfa,
                deposit_status,
                transaction_id,
                provider_payment_url,
                notes,
                created_at,
                agent_id,
                booking_items(id)
            `)
            .order('start_time', { ascending: false })
            .limit(100)

        if (type === 'restaurant') {
            query = query.eq('booking_source', 'restaurant')
        } else if (normalizedType && normalizedType !== 'all') {
            query = query.eq('booking_type', normalizedType)
        }

        const { data: bookings, error } = await query

        if (error) {
            // If table doesn't exist yet
            if (error.code === '42P01') {
                return successResponse({ bookings: [], message: 'Table bookings not created yet' })
            }
            throw error
        }

        const bookingRows: BookingRow[] = bookings || []
        const agentIds = [...new Set(bookingRows.map(booking => booking.agent_id).filter(Boolean))]

        const { data: agents } = agentIds.length > 0
            ? await adminSupabase
                .from('agents')
                .select('id, name, user_id')
                .in('id', agentIds)
            : { data: [] as AgentRow[] }

        const ownerIds = [...new Set((agents || []).map(agent => agent.user_id).filter(Boolean))]
        const { data: owners } = ownerIds.length > 0
            ? await adminSupabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', ownerIds)
            : { data: [] as OwnerRow[] }

        const agentMap = new Map((agents || []).map(agent => [agent.id, agent]))
        const ownerMap = new Map((owners || []).map(owner => [owner.id, owner]))

        const bookingsWithDetails = bookingRows.map(booking => {
            const agent = booking.agent_id ? agentMap.get(booking.agent_id) : null
            const owner = agent?.user_id ? ownerMap.get(agent.user_id) : null

            return {
                ...booking,
                items_count: booking.booking_items?.length || 0,
                booking_items: undefined,
                agent_name: agent?.name || null,
                vendor_name: owner?.full_name || null,
                vendor_email: owner?.email || null
            }
        })

        return successResponse({ bookings: bookingsWithDetails })
    } catch (err) {
        console.error('Admin bookings error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
