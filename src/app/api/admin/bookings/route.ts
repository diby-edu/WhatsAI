import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { BookingSelectRow, BOOKING_SELECT_COLUMNS } from '@/lib/bookings/types'

export const dynamic = 'force-dynamic'

type BookingRow = BookingSelectRow & {
    agent_id: string | null
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
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

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
            .select(`${BOOKING_SELECT_COLUMNS}, agent_id`)
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
