async function clearRestaurantConversationState(supabase, conversationId) {
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

// 1. PAYMENT REMINDERS
async function checkPendingPayments(supabase) {
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

        const { data: pendingOrders } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone, total_fcfa, provider_payment_url, created_at')
            .eq('status', 'pending')
            .eq('payment_method', 'online')
            .lt('created_at', fifteenMinutesAgo)
            .or('payment_reminder_sent.is.null,payment_reminder_sent.eq.false')

        for (const order of pendingOrders || []) {
            if (!order.provider_payment_url) continue

            console.log('Sending payment reminder for order:', order.id)

            await supabase.from('outbound_messages').insert({
                agent_id: order.agent_id,
                recipient_phone: order.customer_phone,
                message_content: `⏰ *Rappel de paiement*\n\nVotre commande #${order.id.substring(0, 8)} attend votre paiement.\n\n💰 Montant: ${order.total_fcfa.toLocaleString()} FCFA\n\n💳 Cliquez ici pour payer:\n${order.provider_payment_url}\n\nBesoin d'aide ? Repondez a ce message.`,
                status: 'pending'
            })

            await supabase.from('orders').update({
                payment_reminder_sent: true,
                payment_reminder_sent_at: new Date().toISOString()
            }).eq('id', order.id)
        }
    } catch (error) {
        console.error('Error checking pending payments:', error)
    }
}

// Re-vérification du statut réel côté provider avant annulation.
// La route de statut publique re-vérifie la transaction auprès du provider
// et FINALISE la commande si elle est payée (webhook perdu → rattrapage).
// Retourne true si la commande peut être annulée sans risque.
async function isSafeToCancelOrder(order) {
    const txId = order.transaction_id || order.provider_transaction_id
    if (!txId) return true // aucun paiement initié → annulation sans risque

    const webBaseUrl = process.env.INTERNAL_WEB_URL || 'http://127.0.0.1:3000'
    try {
        const res = await fetch(
            `${webBaseUrl}/api/payments/cinetpay/status?transaction_id=${encodeURIComponent(txId)}`,
            { signal: AbortSignal.timeout(20000) }
        )
        if (!res.ok) {
            // Route de statut en erreur : ne pas interpréter comme "non payé".
            console.error('Provider status check returned non-OK, skipping cancellation this run:', order.id, res.status)
            return false
        }
        const data = await res.json()
        if (data && data.status === 'ACCEPTED') {
            // Payée : la route de statut vient de la finaliser — ne PAS annuler.
            console.log('Order actually paid at provider, finalized instead of cancelled:', order.id)
            return false
        }
        return true
    } catch (error) {
        // Provider/web injoignable : ne pas annuler à l'aveugle, on retentera au prochain run.
        console.error('Provider status check failed, skipping cancellation this run:', order.id, error?.message)
        return false
    }
}

// 2. ORDER EXPIRATION
async function cancelExpiredOrders(supabase) {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

        const { data: expiredOrders } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone, transaction_id, provider_transaction_id')
            .eq('status', 'pending')
            .eq('payment_method', 'online')
            .lt('created_at', oneHourAgo)

        for (const order of expiredOrders || []) {
            if (!(await isSafeToCancelOrder(order))) continue

            console.log('Cancelling expired order:', order.id)

            const { data: updatedOrder, error: updateError } = await supabase
                .from('orders')
                .update({
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', order.id)
                .eq('status', 'pending')
                .select('id')
                .maybeSingle()

            if (updateError || !updatedOrder) {
                continue
            }

            await supabase.from('outbound_messages').insert({
                agent_id: order.agent_id,
                recipient_phone: order.customer_phone,
                message_content: `⏱️ *Commande expiree*\n\nVotre commande #${order.id.substring(0, 8)} a ete annulee car le paiement n'a pas ete recu dans les temps.\n\nVous pouvez repasser commande quand vous le souhaitez ! 😊`,
                status: 'pending'
            })
        }
    } catch (error) {
        console.error('Error cancelling expired orders:', error)
    }
}

// 3. RESTAURANT DEPOSIT EXPIRATION
async function cancelExpiredBookingDeposits(supabase) {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const { data: expiredBookings } = await supabase
            .from('bookings')
            .select('id, agent_id, customer_phone, customer_name, service_name, start_time, conversation_id, transaction_id, provider_transaction_id')
            .eq('booking_source', 'restaurant')
            .eq('status', 'pending')
            .eq('deposit_required', true)
            .eq('deposit_status', 'pending')
            .lt('created_at', twentyFourHoursAgo)

        for (const booking of expiredBookings || []) {
            // Même garde que pour les commandes : un acompte réellement payé
            // (webhook perdu) est finalisé par la re-vérification, pas expiré.
            if (!(await isSafeToCancelOrder(booking))) continue

            console.log('Expiring pending restaurant deposit:', booking.id)

            const { data: updatedBooking, error: updateError } = await supabase
                .from('bookings')
                .update({
                    deposit_status: 'expired',
                    updated_at: new Date().toISOString()
                })
                .eq('id', booking.id)
                .eq('deposit_status', 'pending')
                .select('id')
                .maybeSingle()

            if (updateError || !updatedBooking) {
                continue
            }

            await clearRestaurantConversationState(supabase, booking.conversation_id)

            if (!booking.customer_phone) continue

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

            await supabase.from('outbound_messages').insert({
                agent_id: booking.agent_id,
                recipient_phone: booking.customer_phone,
                message_content: `⌛ *Reservation en attente expiree*\n\nBonjour ${booking.customer_name || ''}.\n\nL'acompte pour ${serviceName}${dateStr ? ` le ${dateStr}` : ''} n'a pas ete recu dans les 24h, la demande d'acompte est donc expiree.\n\nVous pouvez relancer la reservation si besoin en nous recontactant.`,
                status: 'pending'
            })
        }
    } catch (error) {
        console.error('Error cancelling expired booking deposits:', error)
    }
}

// 4. FEEDBACK REQUESTS
async function requestFeedback(supabase) {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()

        const { data: deliveredOrders } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone, delivered_at')
            .eq('status', 'delivered')
            .or('feedback_requested.is.null,feedback_requested.eq.false')
            .lt('delivered_at', threeDaysAgo)
            .gt('delivered_at', fourDaysAgo)

        if (deliveredOrders?.length) {
            const outboundRows = deliveredOrders.map(order => ({
                agent_id: order.agent_id,
                recipient_phone: order.customer_phone,
                message_content: `😊 *Livraison effectuee ?*\n\nPouvez-vous nous donner votre avis sur votre commande #${order.id.substring(0, 8)} ?\n\nRepondez simplement:\n1. Tres satisfait 🌟\n2. Satisfait 🙂\n3. Decu 😞\n\nMerci !`,
                status: 'pending'
            }))
            await supabase.from('outbound_messages').insert(outboundRows)

            await supabase.from('orders').update({
                feedback_requested: true,
                feedback_requested_at: new Date().toISOString()
            }).in('id', deliveredOrders.map(order => order.id))
        }
    } catch (error) {
        console.error('Error requesting feedback:', error)
    }
}

module.exports = {
    checkPendingPayments,
    cancelExpiredOrders,
    cancelExpiredBookingDeposits,
    requestFeedback
}
