import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

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

    if (profile?.role !== 'admin') {
        return errorResponse('Forbidden - Admin only', 403)
    }

    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')

        let query = adminSupabase
            .from('bookings')
            .select(`
                id,
                customer_phone,
                booking_type,
                status,
                start_time,
                party_size,
                notes,
                created_at,
                agent_id
            `)
            .order('start_time', { ascending: false })
            .limit(100)

        if (type && type !== 'all') {
            query = query.eq('booking_type', type)
        }

        const { data: bookings, error } = await query

        if (error) {
            // If table doesn't exist yet
            if (error.code === '42P01') {
                return successResponse({ bookings: [], message: 'Table bookings not created yet' })
            }
            throw error
        }

        // Get agent names
        const bookingsWithDetails = await Promise.all(
            (bookings || []).map(async (booking: any) => {
                let agentName = null
                if (booking.agent_id) {
                    const { data: agent } = await adminSupabase
                        .from('agents')
                        .select('name')
                        .eq('id', booking.agent_id)
                        .single()
                    agentName = agent?.name
                }
                return { ...booking, agent_name: agentName }
            })
        )

        return successResponse({ bookings: bookingsWithDetails })
    } catch (err) {
        console.error('Admin bookings error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
