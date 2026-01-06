import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

// PATCH - Update order status (admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
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
        const body = await request.json()
        const { status } = body

        if (!status) {
            return errorResponse('Status is required', 400)
        }

        const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
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
        const { data: order, error } = await adminSupabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error

        // Get order items
        const { data: items } = await adminSupabase
            .from('order_items')
            .select('*')
            .eq('order_id', id)

        return successResponse({ order: { ...order, items: items || [] } })
    } catch (err) {
        console.error('Error fetching order:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
