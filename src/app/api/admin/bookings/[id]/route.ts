import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'
import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'

async function clearRestaurantConversationState(
    adminSupabase: ReturnType<typeof createAdminClient>,
    conversationId: string | null | undefined
) {
    if (!conversationId) return

    const { data: conversation } = await adminSupabase
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single()

    if (!conversation?.metadata?.restaurant) return

    await adminSupabase
        .from('conversations')
        .update({
            metadata: {
                ...conversation.metadata,
                restaurant: null,
            },
        })
        .eq('id', conversationId)
}

// PATCH - Update booking status (admin only)
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

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Forbidden - Admin only', 403)
    }

    try {
        const body = await request.json()
        const { status, deposit_status: depositStatus } = body

        if (!status && !depositStatus) {
            return errorResponse('status or deposit_status is required', 400)
        }

        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled']
        if (status && !validStatuses.includes(status)) {
            return errorResponse('Invalid status', 400)
        }

        const validDepositStatuses = ['pending', 'paid', 'expired', 'waived', 'not_required']
        if (depositStatus && !validDepositStatuses.includes(depositStatus)) {
            return errorResponse('Invalid deposit_status', 400)
        }

        const { data: existingBooking, error: existingBookingError } = await adminSupabase
            .from('bookings')
            .select('status, deposit_status, customer_phone, customer_name, service_name, start_time, agent_id, conversation_id, booking_source')
            .eq('id', id)
            .single()

        if (existingBookingError || !existingBooking) {
            return errorResponse('Booking not found', 404)
        }

        if (depositStatus) {
            const currentDepositStatus = existingBooking.deposit_status || 'not_required'
            const sameDepositStatus = depositStatus === currentDepositStatus
            const validDepositTransition =
                currentDepositStatus === 'pending' &&
                ['paid', 'waived', 'expired'].includes(depositStatus)

            if (!sameDepositStatus && !validDepositTransition) {
                return errorResponse('Invalid deposit status transition', 400)
            }
        }

        const requiresDepositConfirmation =
            existingBooking.booking_source === 'restaurant' &&
            existingBooking.deposit_status === 'pending'

        if ((status === 'confirmed' || status === 'completed') && requiresDepositConfirmation) {
            return errorResponse('Deposit still pending - confirm payment or waive deposit first', 400)
        }

        const updatePayload: Record<string, string> = {
            updated_at: new Date().toISOString(),
        }

        if (status) {
            updatePayload.status = status
        }

        if (depositStatus) {
            updatePayload.deposit_status = depositStatus

            if ((depositStatus === 'paid' || depositStatus === 'waived') && existingBooking.status === 'pending' && !status) {
                updatePayload.status = 'confirmed'
            }
        }

        const { error } = await adminSupabase
            .from('bookings')
            .update(updatePayload)
            .eq('id', id)

        if (error) throw error

        const finalStatus = updatePayload.status || existingBooking.status
        const statusChanged = finalStatus !== existingBooking.status
        if (statusChanged && (finalStatus === 'confirmed' || finalStatus === 'completed') && existingBooking.customer_phone) {
            try {
                const serviceName = existingBooking.service_name || 'votre reservation'
                const dateStr = existingBooking.start_time
                    ? new Date(existingBooking.start_time).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                    })
                    : null

                let msg = ''
                if (finalStatus === 'confirmed') {
                    msg = `Reservation confirmee !\n\nBonjour ${existingBooking.customer_name || ''} !\n\nVotre reservation pour *${serviceName}*${dateStr ? ` le ${dateStr}` : ''} est confirmee.\n\nMerci pour votre confiance !`
                } else {
                    msg = `Merci de votre visite !\n\nBonjour ${existingBooking.customer_name || ''} !\n\nNous esperons que vous avez apprecie *${serviceName}*.\n\nN'hesitez pas a reserver a nouveau !`
                }

                await queueOutboundWhatsAppMessage(adminSupabase, {
                    agentId: existingBooking.agent_id,
                    to: existingBooking.customer_phone,
                    message: msg,
                })
            } catch (notifyError) {
                console.error('Booking WhatsApp notification error (non-blocking):', notifyError)
            }
        }

        const shouldClearRestaurantState =
            existingBooking.booking_source === 'restaurant' &&
            (
                ['paid', 'waived', 'expired'].includes(updatePayload.deposit_status || '') ||
                ['cancelled', 'completed'].includes(finalStatus)
            )

        if (shouldClearRestaurantState) {
            await clearRestaurantConversationState(adminSupabase, existingBooking.conversation_id)
        }

        return successResponse({
            message: 'Booking updated',
            bookingId: id,
            newStatus: finalStatus,
            depositStatus: updatePayload.deposit_status || existingBooking.deposit_status || null,
        })
    } catch (err) {
        console.error('Error updating booking:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
