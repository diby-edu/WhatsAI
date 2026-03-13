import { NextRequest } from 'next/server'
import { createApiClient, successResponse, errorResponse, getAuthUser } from '@/lib/api-utils'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    try {
        const body = await request.json()
        const { status } = body

        // Validate status
        const validStatuses = ['pending', 'paid', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'pending_delivery', 'refunded']
        if (!validStatuses.includes(status)) {
            return errorResponse(`Statut invalide: ${status}`)
        }

        // Check order exists and belongs to user
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, user_id, status, customer_phone, agent_id')
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return errorResponse('Commande non trouvée', 404)
        }

        if (order.user_id !== user.id) {
            return errorResponse('Vous n\'êtes pas autorisé à modifier cette commande', 403)
        }

        // Update timestamps based on status
        const updates: Record<string, any> = { status, updated_at: new Date().toISOString() }

        if (status === 'confirmed') updates.confirmed_at = new Date().toISOString()
        if (status === 'shipped') updates.shipped_at = new Date().toISOString()
        if (status === 'delivered') updates.delivered_at = new Date().toISOString()
        if (status === 'cancelled') updates.cancelled_at = new Date().toISOString()

        const { error: updateError } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', orderId)

        if (updateError) {
            console.error('Error updating order status:', updateError)
            return errorResponse('Erreur lors de la mise à jour du statut')
        }

        // 🔔 NOTIFICATION: Commande annulée
        if (status === 'cancelled') {
            try {
                const { notify } = await import('@/lib/notifications/notification.service')
                notify(user.id, 'order_cancelled', {
                    orderNumber: orderId.slice(-8)
                })
            } catch (notifError) {
                console.error('🔔 Notification error (non-blocking):', notifError)
            }
        }

        // 📲 WHATSAPP: Confirmation paiement → client
        if (status === 'paid' && order.customer_phone && order.agent_id) {
            try {
                const { sendWhatsAppMessage } = await import('@/lib/whatsapp/baileys')
                const msg = `✅ Paiement confirmé ! Votre commande a bien été validée et est en cours de préparation.\n\nMerci pour votre confiance ! 🙏`
                await sendWhatsAppMessage(order.agent_id, order.customer_phone, msg)
            } catch (e) {
                console.error('📲 WhatsApp payment confirmation error (non-blocking):', e)
            }
            // 📦 Digital delivery: auto-send digital content if applicable
            try {
                const { deliverDigitalProducts } = await import('@/lib/payments/digital-delivery')
                await deliverDigitalProducts(orderId, supabase)
            } catch (e) {
                console.error('📦 Digital delivery error (non-blocking):', e)
            }
        }

        return successResponse({ message: `Statut mis à jour: ${status}` })
    } catch (err) {
        console.error('Status update error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
