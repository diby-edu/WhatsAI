export function isValidDepositTransition(currentDepositStatus: string, nextDepositStatus: string): boolean {
    const sameDepositStatus = nextDepositStatus === currentDepositStatus
    const validDepositTransition =
        currentDepositStatus === 'pending' &&
        ['paid', 'waived', 'expired'].includes(nextDepositStatus)

    return sameDepositStatus || validDepositTransition
}

export function buildBookingStatusUpdate({
    status,
    depositStatus,
    currentBookingStatus,
}: {
    status?: string
    depositStatus?: string
    currentBookingStatus: string
}): Record<string, string> {
    const updatePayload: Record<string, string> = {
        updated_at: new Date().toISOString(),
    }

    if (status) {
        updatePayload.status = status
    }

    if (depositStatus) {
        updatePayload.deposit_status = depositStatus

        if ((depositStatus === 'paid' || depositStatus === 'waived') && currentBookingStatus === 'pending' && !status) {
            updatePayload.status = 'confirmed'
        }
    }

    return updatePayload
}

export function buildBookingConfirmationMessage(
    finalStatus: string,
    booking: { customer_name: string | null; service_name: string | null; start_time: string | null }
): string {
    const serviceName = booking.service_name || 'votre reservation'
    const dateStr = booking.start_time
        ? new Date(booking.start_time).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
        })
        : null

    return finalStatus === 'confirmed'
        ? `Reservation confirmee !\n\nBonjour ${booking.customer_name || ''} !\n\nVotre reservation pour *${serviceName}*${dateStr ? ` le ${dateStr}` : ''} est confirmee.\n\nMerci pour votre confiance !`
        : `Merci de votre visite !\n\nBonjour ${booking.customer_name || ''} !\n\nNous esperons que vous avez apprecie *${serviceName}*.\n\nN'hesitez pas a reserver a nouveau !`
}

export async function clearRestaurantConversationState(
    supabase: any,
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
            },
        })
        .eq('id', conversationId)
}
