import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

// PATCH - Update order status (admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const body = await request.json()
        const { status } = body

        if (!status) {
            return errorResponse('Status is required', 400)
        }

        const validStatuses = ['pending', 'paid', 'confirmed', 'completed', 'shipped', 'delivered', 'cancelled', 'pending_pickup', 'pending_delivery']
        if (!validStatuses.includes(status)) {
            return errorResponse('Invalid status', 400)
        }

        const { error } = await adminSupabase
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error

        return successResponse({ message: 'Order updated', orderId: id, newStatus: status })
    } catch (err) {
        console.error('Error updating order:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// GET - Get single order details (admin only)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { data: order, error } = await adminSupabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error

        // Get order items with product type
        const { data: rawItems } = await adminSupabase
            .from('order_items')
            .select('*, product:products(product_type)')
            .eq('order_id', id)

        const items = (rawItems || []).map((item: any) => ({
            ...item,
            product_type: item.product?.product_type || item.product_type || null,
            product: undefined
        }))

        // Get agent info for payment mode
        let agent_payment_mode: string | null = null
        if (order.agent_id) {
            const { data: agent } = await adminSupabase
                .from('agents')
                .select('payment_mode')
                .eq('id', order.agent_id)
                .single()
            agent_payment_mode = agent?.payment_mode || null
        }

        return successResponse({ order: { ...order, items, agent_payment_mode } })
    } catch (err) {
        console.error('Error fetching order:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
