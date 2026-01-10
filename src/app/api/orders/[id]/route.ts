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
            return errorResponse('Commande non trouvée', 404)
        }

        // Transform items to match frontend expectations
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
                    image_url: null
                }
            }))
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

        // Get order BEFORE update to check old status
        const { data: oldOrder } = await supabase
            .from('orders')
            .select('status, customer_phone, conversation_id, total_fcfa, agent_id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        const updateData: any = {}

        if (body.status) {
            updateData.status = body.status

            // Set timestamp based on status change
            if (body.status === 'confirmed') updateData.confirmed_at = new Date().toISOString()
            if (body.status === 'paid') updateData.paid_at = new Date().toISOString()
            if (body.status === 'shipped') updateData.shipped_at = new Date().toISOString()
            if (body.status === 'delivered') updateData.delivered_at = new Date().toISOString()
            if (body.status === 'cancelled') updateData.cancelled_at = new Date().toISOString()

            // Also update payment_verification_status for mobile money
            if (body.status === 'paid') {
                updateData.payment_verification_status = 'verified'
            }
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

        // 📱 SEND WHATSAPP NOTIFICATION when status changes to 'paid'
        if (body.status === 'paid' && oldOrder?.status !== 'paid' && oldOrder?.customer_phone) {
            try {
                const confirmationMessage = `✅ *Paiement Confirmé !*\n\nVotre paiement de ${oldOrder.total_fcfa || order.total_fcfa} FCFA a été vérifié et accepté.\n\n🎉 Commande #${id.substring(0, 8)} confirmée !\n\nMerci pour votre confiance. Nous allons traiter votre commande dans les plus brefs délais.`

                // Call internal send API
                await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/internal/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agentId: oldOrder.agent_id,
                        phone: oldOrder.customer_phone,
                        message: confirmationMessage
                    })
                })

                console.log('✅ WhatsApp notification sent for order:', id)
            } catch (notifError) {
                console.error('Failed to send WhatsApp notification:', notifError)
                // Don't fail the request if notification fails
            }
        }

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
