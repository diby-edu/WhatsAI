import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - List ALL orders (admin only)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    // Check if user is admin
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
        const status = searchParams.get('status')

        let query = adminSupabase
            .from('orders')
            .select(`
                id,
                customer_phone,
                customer_name,
                total_fcfa,
                status,
                created_at,
                delivery_address,
                notes,
                agent_id,
                user_id
            `)
            .order('created_at', { ascending: false })
            .limit(100)

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }

        const { data: orders, error } = await query

        if (error) throw error

        // Get agent names for each order
        const ordersWithDetails = await Promise.all(
            (orders || []).map(async (order: any) => {
                let agentName = null
                let userEmail = null

                if (order.agent_id) {
                    const { data: agent } = await adminSupabase
                        .from('agents')
                        .select('name')
                        .eq('id', order.agent_id)
                        .single()
                    agentName = agent?.name
                }

                if (order.user_id) {
                    const { data: userProfile } = await adminSupabase
                        .from('profiles')
                        .select('email')
                        .eq('id', order.user_id)
                        .single()
                    userEmail = userProfile?.email
                }

                // Get items count
                const { count } = await adminSupabase
                    .from('order_items')
                    .select('*', { count: 'exact', head: true })
                    .eq('order_id', order.id)

                return {
                    ...order,
                    agent_name: agentName,
                    user_email: userEmail,
                    items_count: count || 0
                }
            })
        )

        return successResponse({ orders: ordersWithDetails })
    } catch (err) {
        console.error('Admin orders error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
