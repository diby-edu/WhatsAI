import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// POST /api/orders/[id]/verify - Verify or reject a Mobile Money payment
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: orderId } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()
        const { action } = body // 'verify' or 'reject'

        if (!action || !['verify', 'reject'].includes(action)) {
            return errorResponse('Action invalide', 400)
        }

        // Get order with conversation
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, user_id, customer_phone, total_fcfa, conversation_id, payment_verification_status')
            .eq('id', orderId)
            .eq('user_id', user!.id)
            .single()

        if (orderError || !order) {
            return errorResponse('Commande non trouvée', 404)
        }

        if (order.payment_verification_status !== 'awaiting_verification') {
            return errorResponse('Cette commande n\'est pas en attente de vérification', 400)
        }

        if (action === 'verify') {
            // Confirm payment
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    status: 'paid',
                    payment_verification_status: 'verified',
                    verified_at: new Date().toISOString(),
                    verified_by: user!.id
                })
                .eq('id', orderId)

            if (updateError) {
                return errorResponse('Erreur lors de la mise à jour', 500)
            }

            // Send confirmation message to customer via bot
            if (order.conversation_id) {
                await supabase.from('messages').insert({
                    conversation_id: order.conversation_id,
                    agent_id: null, // Will be filled by a trigger or we can query it
                    role: 'assistant',
                    content: `🎉 *Paiement confirmé !*\n\nVotre paiement de ${order.total_fcfa.toLocaleString('fr-FR')} FCFA pour la commande #${orderId.substring(0, 8)} a été vérifié avec succès.\n\n✅ Votre commande sera traitée sous peu. Merci pour votre confiance !`,
                    status: 'pending'
                })
            }

            return successResponse({
                success: true,
                message: 'Paiement confirmé',
                order_id: orderId
            })

        } else {
            // Reject payment
            const { error: updateError } = await supabase
                .from('orders')
                .update({
                    payment_verification_status: 'rejected',
                    verified_at: new Date().toISOString(),
                    verified_by: user!.id
                })
                .eq('id', orderId)

            if (updateError) {
                return errorResponse('Erreur lors de la mise à jour', 500)
            }

            // Send rejection message to customer
            if (order.conversation_id) {
                await supabase.from('messages').insert({
                    conversation_id: order.conversation_id,
                    agent_id: null,
                    role: 'assistant',
                    content: `❌ *Paiement non validé*\n\nNous n'avons pas pu valider votre paiement pour la commande #${orderId.substring(0, 8)} (${order.total_fcfa.toLocaleString('fr-FR')} FCFA).\n\n📞 Si vous pensez qu'il s'agit d'une erreur, veuillez renvoyer une capture d'écran plus claire ou contacter notre support.`,
                    status: 'pending'
                })
            }

            return successResponse({
                success: true,
                message: 'Paiement rejeté',
                order_id: orderId
            })
        }

    } catch (err) {
        console.error('Verify error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
