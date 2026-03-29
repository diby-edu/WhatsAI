import { NextRequest } from 'next/server'
import { createApiClient, successResponse, errorResponse, getAuthUser } from '@/lib/api-utils'

async function clearRestaurantConversationState(
    supabase: Awaited<ReturnType<typeof createApiClient>>,
    conversationId: string | null | undefined
) {
    if (!conversationId) return

    const { data: conversation } = await supabase
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single()

    if (!conversation?.metadata?.restaurant) return

    await supabase
        .from('conversations')
        .update({
            metadata: {
                ...conversation.metadata,
                restaurant: null,
            }
        })
        .eq('id', conversationId)
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: bookingId } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorise', 401)
    }

    try {
        const body = await request.json()
        const { status, deposit_status: depositStatus } = body

        if (!status && !depositStatus) {
            return errorResponse('status or deposit_status is required', 400)
        }

        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'inscription_pending']
        if (status && !validStatuses.includes(status)) {
            return errorResponse(`Statut invalide: ${status}`)
        }

        const validDepositStatuses = ['pending', 'paid', 'expired', 'waived', 'not_required']
        if (depositStatus && !validDepositStatuses.includes(depositStatus)) {
            return errorResponse(`Statut acompte invalide: ${depositStatus}`, 400)
        }

        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, agent_id, status, customer_phone, customer_name, service_name, start_time, deposit_required, deposit_status, booking_source, conversation_id')
            .eq('id', bookingId)
            .single()

        if (bookingError || !booking) {
            return errorResponse('Reservation non trouvee', 404)
        }

        const currentDepositStatus = booking.deposit_status || 'not_required'
        const requiresDepositConfirmation = booking.deposit_required && currentDepositStatus === 'pending'
        if ((status === 'confirmed' || status === 'completed') && requiresDepositConfirmation) {
            return errorResponse('Acompte en attente - confirmez d abord le paiement ou faites lever l acompte', 400)
        }

        const { data: agent } = await supabase
            .from('agents')
            .select('id, user_id')
            .eq('id', booking.agent_id)
            .single()

        if (!agent || agent.user_id !== user.id) {
            return errorResponse('Vous n etes pas autorise a modifier cette reservation', 403)
        }

        if (depositStatus) {
            const sameDepositStatus = depositStatus === currentDepositStatus
            const validDepositTransition =
                currentDepositStatus === 'pending' &&
                ['paid', 'waived', 'expired'].includes(depositStatus)

            if (!sameDepositStatus && !validDepositTransition) {
                return errorResponse('Transition de statut acompte invalide', 400)
            }
        }

        const updatePayload: Record<string, string> = {
            updated_at: new Date().toISOString()
        }

        if (status) {
            updatePayload.status = status
        }

        if (depositStatus) {
            updatePayload.deposit_status = depositStatus

            if ((depositStatus === 'paid' || depositStatus === 'waived') && booking.status === 'pending' && !status) {
                updatePayload.status = 'confirmed'
            }
        }

        const { error: updateError } = await supabase
            .from('bookings')
            .update(updatePayload)
            .eq('id', bookingId)

        if (updateError) {
            console.error('Error updating booking status:', updateError)
            return errorResponse('Erreur lors de la mise a jour du statut')
        }

        const finalStatus = updatePayload.status || booking.status
        const statusChanged = finalStatus !== booking.status
        if (statusChanged && (finalStatus === 'confirmed' || finalStatus === 'completed') && booking.customer_phone) {
            try {
                const { sendWhatsAppMessage } = await import('@/lib/whatsapp/baileys')
                const serviceName = booking.service_name || 'votre reservation'
                const dateStr = booking.start_time
                    ? new Date(booking.start_time).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : null

                const msg = finalStatus === 'confirmed'
                    ? `Reservation confirmee !\n\nBonjour ${booking.customer_name || ''} !\n\nVotre reservation pour *${serviceName}*${dateStr ? ` le ${dateStr}` : ''} est confirmee.\n\nMerci pour votre confiance !`
                    : `Merci de votre visite !\n\nBonjour ${booking.customer_name || ''} !\n\nNous esperons que vous avez apprecie *${serviceName}*.\n\nN hesitez pas a reserver a nouveau !`

                await sendWhatsAppMessage(booking.agent_id, booking.customer_phone, msg)
            } catch (e) {
                console.error('Booking WhatsApp notification error (non-blocking):', e)
            }
        }

        const shouldClearRestaurantState =
            booking.booking_source === 'restaurant' &&
            (
                ['paid', 'waived', 'expired'].includes(updatePayload.deposit_status || '') ||
                ['cancelled', 'completed'].includes(finalStatus)
            )

        if (shouldClearRestaurantState) {
            await clearRestaurantConversationState(supabase, booking.conversation_id)
        }

        return successResponse({
            message: `Statut mis a jour: ${finalStatus}`,
            newStatus: finalStatus,
            depositStatus: updatePayload.deposit_status || currentDepositStatus
        })
    } catch (err) {
        console.error('Booking status update error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
