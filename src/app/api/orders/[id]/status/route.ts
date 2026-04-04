import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, successResponse, errorResponse, getAuthUser } from '@/lib/api-utils'
import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorise', 401)
    }

    try {
        const body = await request.json()
        const { status } = body

        const validStatuses = ['pending', 'paid', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'pending_delivery', 'pending_pickup', 'refunded']
        if (!validStatuses.includes(status)) {
            return errorResponse(`Statut invalide: ${status}`)
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, user_id, status, customer_phone, agent_id')
            .eq('id', orderId)
            .single()

        if (orderError || !order) {
            return errorResponse('Commande non trouvee', 404)
        }

        if (order.user_id !== user.id) {
            return errorResponse("Vous n'etes pas autorise a modifier cette commande", 403)
        }

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
            return errorResponse('Erreur lors de la mise a jour du statut')
        }

        if (status === 'cancelled') {
            try {
                const { notify } = await import('@/lib/notifications/notification.service')
                notify(user.id, 'order_cancelled', {
                    orderNumber: orderId.slice(-8),
                })
            } catch (notifError) {
                console.error('Notification error (non-blocking):', notifError)
            }
        }

        if (order.customer_phone && order.agent_id) {
            const whatsappMessages: Record<string, string> = {
                paid: `✅ Paiement confirme ! Votre commande a bien ete validee et est en cours de preparation.\n\nMerci pour votre confiance !`,
                confirmed: `✅ Votre commande a ete confirmee ! Nous preparons votre service.\n\nMerci pour votre confiance !`,
                shipped: `📦 Votre commande est en route ! Elle a ete expediee et vous sera livree prochainement.\n\nMerci de votre patience !`,
                pending_pickup: `🛍️ Votre commande est prete pour retrait ! Vous pouvez venir la recuperer des que possible.\n\nMerci pour votre confiance !`,
                delivered: `🎉 Votre commande a ete livree ! Nous esperons que vous etes satisfait(e).\n\nN'hesitez pas a nous contacter si vous avez des questions.`,
                cancelled: `❌ Votre commande a ete annulee. Si vous pensez que c'est une erreur, contactez-nous.\n\nNous nous excusons pour le desagrement.`,
            }
            const msg = whatsappMessages[status]
            if (msg) {
                try {
                    const adminSupabase = createAdminClient()
                    await queueOutboundWhatsAppMessage(adminSupabase, {
                        agentId: order.agent_id,
                        to: order.customer_phone,
                        message: msg,
                    })
                } catch (e) {
                    console.error(`WhatsApp [${status}] notification error (non-blocking):`, e)
                }
            }
        }

        if (status === 'paid' && order.customer_phone && order.agent_id) {
            try {
                const { deliverDigitalProducts } = await import('@/lib/payments/digital-delivery')
                await deliverDigitalProducts(orderId, supabase)
            } catch (e) {
                console.error('Digital delivery error (non-blocking):', e)
            }
        }

        return successResponse({ message: `Statut mis a jour: ${status}` })
    } catch (err) {
        console.error('Status update error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
