import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'
import { buildOrderStatusTimestamps, buildOrderPaymentConfirmationMessage } from '@/lib/services/order-status.service'

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
                items:order_items(
                    id,
                    product_name,
                    quantity,
                    unit_price_fcfa
                ),
                conversation:conversations(id, contact_phone, contact_push_name)
            `)
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error || !order) {
            return errorResponse('Commande non trouvee', 404)
        }

        const transformedOrder = {
            ...order,
            order_number: `#CMD-${order.created_at?.slice(0, 10).replace(/-/g, '')}-${order.id.substring(0, 4).toUpperCase()}`,
            total_amount: order.total_fcfa,
            items: (order.items || []).map((item: any) => ({
                id: item.id,
                quantity: item.quantity,
                unit_price: item.unit_price_fcfa,
                total_price: item.unit_price_fcfa * item.quantity,
                product: {
                    name: item.product_name,
                    image_url: null,
                },
            })),
        }

        return successResponse({ order: transformedOrder })
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

        const { data: oldOrder } = await supabase
            .from('orders')
            .select('status, customer_phone, conversation_id, total_fcfa, agent_id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        const updateData: Record<string, any> = {}

        if (body.status) {
            updateData.status = body.status
            Object.assign(updateData, buildOrderStatusTimestamps(body.status))
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

        if (body.status === 'paid' && oldOrder?.status !== 'paid' && oldOrder?.customer_phone) {
            try {
                const confirmationMessage = buildOrderPaymentConfirmationMessage(id, oldOrder.total_fcfa || order.total_fcfa)
                const adminSupabase = createAdminClient()

                await queueOutboundWhatsAppMessage(adminSupabase, {
                    agentId: oldOrder.agent_id,
                    to: oldOrder.customer_phone,
                    message: confirmationMessage,
                })

                console.log('WhatsApp notification queued for order:', id)
            } catch (notifError) {
                console.error('Failed to queue WhatsApp notification:', notifError)
            }
        }

        return successResponse({ order })
    } catch (err) {
        console.error('Error updating order:', err)
        return errorResponse('Erreur lors de la mise a jour', 500)
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
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)
            .eq('status', 'pending')

        if (error) throw error

        return successResponse({ message: 'Commande supprimee' })
    } catch (err) {
        console.error('Error deleting order:', err)
        return errorResponse('Erreur lors de la suppression', 500)
    }
}
