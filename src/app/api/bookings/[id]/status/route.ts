import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, successResponse, errorResponse, getAuthUser } from '@/lib/api-utils'
import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'
import {
    isValidDepositTransition,
    buildBookingStatusUpdate,
    buildBookingConfirmationMessage,
    clearRestaurantConversationState,
} from '@/lib/services/booking-status.service'

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
            return errorResponse("Acompte en attente - confirmez d'abord le paiement ou faites lever l'acompte", 400)
        }

        const { data: agent } = await supabase
            .from('agents')
            .select('id, user_id')
            .eq('id', booking.agent_id)
            .single()

        if (!agent || agent.user_id !== user.id) {
            return errorResponse("Vous n'etes pas autorise a modifier cette reservation", 403)
        }

        if (depositStatus && !isValidDepositTransition(currentDepositStatus, depositStatus)) {
            return errorResponse('Transition de statut acompte invalide', 400)
        }

        const updatePayload = buildBookingStatusUpdate({
            status,
            depositStatus,
            currentBookingStatus: booking.status,
        })

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
                const msg = buildBookingConfirmationMessage(finalStatus, booking)
                const adminSupabase = createAdminClient()
                await queueOutboundWhatsAppMessage(adminSupabase, {
                    agentId: booking.agent_id,
                    to: booking.customer_phone,
                    message: msg,
                })
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
            depositStatus: updatePayload.deposit_status || currentDepositStatus,
        })
    } catch (err) {
        console.error('Booking status update error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
