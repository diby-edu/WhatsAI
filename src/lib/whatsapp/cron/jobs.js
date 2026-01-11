
// 1. RELANCE AUTOMATIQUE DES PAIEMENTS
async function checkPendingPayments(supabase) {
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

        const { data: pendingOrders } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone, total_fcfa, cinetpay_payment_url, created_at')
            .eq('status', 'pending')
            .eq('payment_method', 'online')
            .lt('created_at', fifteenMinutesAgo)
            .is('payment_reminder_sent', null)

        for (const order of pendingOrders || []) {
            if (!order.cinetpay_payment_url) continue

            console.log('⏰ Sending payment reminder for order:', order.id)

            await supabase.from('outbound_messages').insert({
                agent_id: order.agent_id,
                recipient_phone: order.customer_phone,
                message_content: `⏰ *Rappel de paiement*\n\nVotre commande #${order.id.substring(0, 8)} attend votre paiement.\n\n💰 Montant: ${order.total_fcfa.toLocaleString()} FCFA\n\n💳 Cliquez ici pour payer:\n${order.cinetpay_payment_url}\n\n❓ Besoin d'aide ? Répondez à ce message.`,
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

// 2. ANNULATION AUTOMATIQUE
async function cancelExpiredOrders(supabase) {
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

        const { data: expiredOrders } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone')
            .eq('status', 'pending')
            .eq('payment_method', 'online')
            .lt('created_at', oneHourAgo)

        for (const order of expiredOrders || []) {
            console.log('❌ Cancelling expired order:', order.id)

            await supabase.from('orders').update({
                status: 'cancelled',
                cancelled_reason: 'Payment timeout (1 hour)'
            }).eq('id', order.id)

            await supabase.from('outbound_messages').insert({
                agent_id: order.agent_id,
                recipient_phone: order.customer_phone,
                message_content: `⏱️ *Commande expirée*\n\nVotre commande #${order.id.substring(0, 8)} a été annulée car le paiement n'a pas été reçu dans les temps.\n\nVous pouvez repasser commande quand vous le souhaitez ! 😊`,
                status: 'pending'
            })
        }
    } catch (error) {
        console.error('Error cancelling expired orders:', error)
    }
}

// 3. DEMANDE FEEDBACK
async function requestFeedback(supabase) {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()

        const { data: deliveredOrders } = await supabase
            .from('orders')
            .select('id, agent_id, customer_phone, delivered_at')
            .eq('status', 'delivered')
            .is('feedback_requested', null)
            .lt('delivered_at', threeDaysAgo)
            .gt('delivered_at', fourDaysAgo)

        for (const order of deliveredOrders || []) {
            await supabase.from('outbound_messages').insert({
                agent_id: order.agent_id,
                recipient_phone: order.customer_phone,
                message_content: `😊 *Livraison effectuée ?*\n\nPouvez-vous nous donner votre avis sur votre commande #${order.id.substring(0, 8)} ?\n\nRépondez simplement:\n1. Très satisfait 🌟\n2. Satisfait 🙂\n3. Déçu 😞\n\nMerci !`,
                status: 'pending'
            })

            await supabase.from('orders').update({
                feedback_requested: true,
                feedback_requested_at: new Date().toISOString()
            }).eq('id', order.id)
        }
    } catch (error) {
        console.error('Error requesting feedback:', error)
    }
}

module.exports = { checkPendingPayments, cancelExpiredOrders, requestFeedback }
