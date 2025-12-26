import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET - Get single order with items
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

    try {
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                items:order_items(*),
                conversation:conversations(id, contact_phone, contact_push_name)
            `)
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error || !order) {
            return errorResponse('Commande non trouvée', 404)
        }

        return successResponse({ order })
    } catch (err) {
        console.error('Error fetching order:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// PATCH - Update order status
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

    try {
        const body = await request.json()

        const updateData: any = {}

        if (body.status) {
            updateData.status = body.status

            // Set timestamp based on status change
            if (body.status === 'confirmed') updateData.confirmed_at = new Date().toISOString()
            if (body.status === 'shipped') updateData.shipped_at = new Date().toISOString()
            if (body.status === 'delivered') updateData.delivered_at = new Date().toISOString()
            if (body.status === 'cancelled') updateData.cancelled_at = new Date().toISOString()
        }

        if (body.delivery_address !== undefined) updateData.delivery_address = body.delivery_address
        if (body.notes !== undefined) updateData.notes = body.notes

        const { data: order, error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) throw error

        return successResponse({ order })
    } catch (err) {
        console.error('Error updating order:', err)
        return errorResponse('Erreur lors de la mise à jour', 500)
    }
}

// DELETE - Delete order (only if pending)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        // Only allow deleting pending orders
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)
            .eq('status', 'pending')

        if (error) throw error

        return successResponse({ message: 'Commande supprimée' })
    } catch (err) {
        console.error('Error deleting order:', err)
        return errorResponse('Erreur lors de la suppression', 500)
    }
}
