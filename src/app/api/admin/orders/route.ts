import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// GET - List ALL orders (admin only)
export async function GET(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

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
                payment_method,
                payment_provider,
                transaction_id,
                fulfillment_mode,
                pickup_at,
                deposit_required,
                deposit_amount_fcfa,
                deposit_status,
                agent:agents(name, payment_mode),
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
            agent_payment_mode: order.agent?.payment_mode || null,
            payment_provider: order.payment_provider || null,
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
