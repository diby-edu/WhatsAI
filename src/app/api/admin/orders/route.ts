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
                user_id,
                agent:agents(name),
                profile:profiles!orders_user_id_fkey(email),
                order_items(id)
            `)
            .order('created_at', { ascending: false })
            .limit(100)

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }

        const { data: orders, error } = await query

        if (error) throw error

        // Format response — single query, no N+1
        const ordersWithDetails = (orders || []).map((order: any) => ({
            ...order,
            agent_name: order.agent?.name || null,
            user_email: order.profile?.email || null,
            items_count: order.order_items?.length || 0,
            agent: undefined,
            profile: undefined,
            order_items: undefined
        }))

        return successResponse({ orders: ordersWithDetails })
    } catch (err) {
        console.error('Admin orders error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
