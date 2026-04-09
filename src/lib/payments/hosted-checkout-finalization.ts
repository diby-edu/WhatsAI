import { notify } from '@/lib/notifications/notification.service'
import { deliverDigitalProducts } from '@/lib/payments/digital-delivery'
import { normalizePaymentProvider, type SupportedPaymentProvider } from '@/lib/payments/provider'
import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'

type SupabaseClientLike = any

function isFullServiceBookingPayment(booking: any) {
    const total = Number(booking?.price_fcfa || 0)
    const charged = Number(booking?.deposit_amount_fcfa || 0)

    return (booking?.booking_source || '') !== 'restaurant'
        && String(booking?.payment_method || '').trim().toLowerCase() === 'online'
        && total > 0
        && charged >= total
}

function providerLabel(providerInput: unknown) {
    return normalizePaymentProvider(providerInput) === 'paystack' ? 'Paystack' : 'CinetPay'
}

function resolveProviderTransactionId(provider: SupportedPaymentProvider, reference: string, providerPayload?: unknown) {
    const payload = (providerPayload && typeof providerPayload === 'object') ? providerPayload as Record<string, any> : {}

    if (provider === 'paystack') {
        return String(payload?.data?.reference || reference || '').trim() || null
    }

    return String(
        payload?.providerTransactionId
        || payload?.data?.payment_token
        || payload?.data?.payment_token_id
        || ''
    ).trim() || null
}

async function queueAssistantMessage(
    supabase: SupabaseClientLike,
    agentId: string | null | undefined,
    conversationId: string | null | undefined,
    customerPhone: string,
    message: string
) {
    if (!agentId || !customerPhone) {
        return
    }

    let conversation: { id: string, contact_phone?: string | null, contact_jid?: string | null } | null = null

    if (conversationId) {
        const { data: linkedConversation } = await supabase
            .from('conversations')
            .select('id, contact_phone, contact_jid')
            .eq('id', conversationId)
            .single()

        if (linkedConversation) {
            conversation = linkedConversation
        }
    }

    if (!conversation) {
        const { data: fallbackConversation } = await supabase
            .from('conversations')
            .select('id, contact_phone, contact_jid')
            .eq('agent_id', agentId)
            .eq('contact_phone', customerPhone)
            .single()

        conversation = fallbackConversation
    }

    const recipient = String(
        conversation?.contact_jid || conversation?.contact_phone || customerPhone || ''
    ).trim()

    let queuedOutbound = false

    if (recipient) {
        try {
            const result = await queueOutboundWhatsAppMessage(supabase, {
                agentId,
                to: recipient,
                message,
            })
            queuedOutbound = result.queued === true
        } catch (queueError) {
            console.error('[Hosted Checkout Finalization] Failed to queue WhatsApp assistant message:', queueError)
        }
    }

    if (conversation) {
        const { error: insertError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversation.id,
                agent_id: agentId,
                role: 'assistant',
                content: message,
                status: queuedOutbound ? 'sent' : 'pending'
            })

        if (!insertError) {
            await supabase
                .from('conversations')
                .update({
                    last_message_text: message.substring(0, 200),
                    last_message_at: new Date().toISOString(),
                    last_message_role: 'assistant'
                })
                .eq('id', conversation.id)
        }
    }
}

async function clearRestaurantConversationState(
    supabase: SupabaseClientLike,
    conversationId: string | null | undefined
) {
    if (!conversationId) {
        return
    }

    const { data: conversation } = await supabase
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single()

    if (!conversation?.metadata?.restaurant) {
        return
    }

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

async function notifyMerchantOrderPayment(
    supabase: SupabaseClientLike,
    order: any,
    paymentLabel: string
) {
    try {
        const { data: agentData } = await supabase
            .from('agents')
            .select('user_id')
            .eq('id', order.agent_id)
            .single()

        if (!agentData) {
            return
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('phone')
            .eq('id', agentData.user_id)
            .single()

        const merchantPhone = profile?.phone
        if (!merchantPhone) {
            return
        }

        const { data: items } = await supabase
            .from('order_items')
            .select('product_name, quantity')
            .eq('order_id', order.id)

        const itemsSummary = items?.map((item: any) => `- ${item.quantity}x ${item.product_name}`).join('\n') || 'Articles divers'

        await supabase
            .from('outbound_messages')
            .insert({
                agent_id: order.agent_id,
                recipient_phone: merchantPhone,
                message_content: `*NOUVEAU PAIEMENT !*\n\nMontant: ${Number(order.total_fcfa || 0).toLocaleString('fr-FR')} FCFA\nCommande: #${order.id.substring(0, 8)}\nClient: ${order.customer_phone}\n\nArticles:\n${itemsSummary}\n\nMode: ${paymentLabel}`,
                status: 'pending'
            })

        await notify(agentData.user_id, 'payment_received', {
            orderNumber: order.id,
            customerName: order.customer_name || order.customer_phone,
            paymentAmount: Number(order.total_fcfa || 0),
            paymentMethod: paymentLabel
        })
    } catch (notifyError) {
        console.error('[Hosted Checkout Finalization] Failed to notify merchant:', notifyError)
    }
}

export function isOrderTransactionId(transactionId: string) {
    return transactionId.startsWith('ORD_') || transactionId.startsWith('ORD-')
}

export function isBookingTransactionId(transactionId: string) {
    return transactionId.startsWith('BKG_') || transactionId.startsWith('BKG-')
}

export async function finalizeHostedOrderPayment(
    supabase: SupabaseClientLike,
    reference: string,
    options: {
        provider: SupportedPaymentProvider
        amount?: number | null
        providerPayload?: unknown
    }
) {
    const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_id', reference)
        .single()

    if (!order) {
        return { ok: false, kind: 'order', state: 'not_found' as const }
    }

    if (order.status === 'paid' || order.status === 'completed') {
        return { ok: true, kind: 'order', state: 'already_finalized' as const, order }
    }

    const provider = normalizePaymentProvider(options.provider)
    const isRestaurantDepositPayment = order.deposit_required && order.deposit_status === 'pending'
    const nextStatus = isRestaurantDepositPayment
        ? (order.fulfillment_mode === 'delivery' ? 'pending_delivery' : 'pending_pickup')
        : 'paid'

    const resolvedProviderTxId = resolveProviderTransactionId(provider, reference, options.providerPayload)
    const orderUpdate: Record<string, unknown> = {
        status: nextStatus,
        payment_provider: provider,
        updated_at: new Date().toISOString(),
    }

    if (resolvedProviderTxId) {
        orderUpdate.provider_transaction_id = resolvedProviderTxId
    }

    if (isRestaurantDepositPayment) {
        orderUpdate.deposit_status = 'paid'
    }

    const { data: updatedOrders, error: updateError } = await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', order.id)
        .eq('status', order.status)
        .select('id, status')

    if (updateError) {
        console.error('[Hosted Checkout Finalization] Failed to update order:', updateError)
        return { ok: false, kind: 'order', state: 'error' as const, error: updateError }
    }

    if (!updatedOrders || updatedOrders.length === 0) {
        const { data: latestOrder } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order.id)
            .single()

        return {
            ok: true,
            kind: 'order',
            state: 'already_finalized' as const,
            order: latestOrder || order,
        }
    }

    try {
        const paidAmount = Number(
            isRestaurantDepositPayment
                ? (order.deposit_amount_fcfa || options.amount || 0)
                : (order.total_fcfa || options.amount || 0)
        )
        const confirmationMessage = isRestaurantDepositPayment
            ? `*Acompte recu !*\n\nMerci ! Votre acompte de ${paidAmount.toLocaleString('fr-FR')} FCFA pour la commande #${order.id.substring(0, 8)} a ete confirme.\n\nVous n'avez plus rien a faire pour le moment. Inutile de renvoyer un message : la suite de votre commande vous sera envoyee ici sur WhatsApp dans quelques instants.\n\nMerci pour votre confiance !`
            : `*Paiement recu !*\n\nMerci ! Votre paiement de ${paidAmount.toLocaleString('fr-FR')} FCFA pour la commande #${order.id.substring(0, 8)} a ete confirme.\n\nVotre commande numerique est en preparation. Elle vous sera envoyee ici sur WhatsApp dans quelques instants.\n\nVous n'avez plus rien a faire pour le moment. Inutile de renvoyer un message.\n\nMerci pour votre confiance !`

        await queueAssistantMessage(
            supabase,
            order.agent_id,
            order.conversation_id,
            order.customer_phone,
            confirmationMessage
        )

        try {
            await deliverDigitalProducts(order.id, supabase)
        } catch (deliveryError) {
            console.error('[Hosted Checkout Finalization] Digital delivery error (non-blocking):', deliveryError)
        }

        await notifyMerchantOrderPayment(supabase, order, providerLabel(provider))

        if (isRestaurantDepositPayment) {
            await clearRestaurantConversationState(supabase, order.conversation_id)
        }
    } catch (notifyError) {
        console.error('[Hosted Checkout Finalization] Failed to send order confirmation:', notifyError)
    }

    return { ok: true, kind: 'order', state: 'finalized' as const, orderId: order.id }
}

export async function finalizeHostedBookingPayment(
    supabase: SupabaseClientLike,
    reference: string,
    options: {
        provider: SupportedPaymentProvider
        amount?: number | null
        providerPayload?: unknown
    }
) {
    const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('transaction_id', reference)
        .single()

    if (!booking) {
        return { ok: false, kind: 'booking', state: 'not_found' as const }
    }

    const isTerminalDepositState = ['paid', 'waived', 'expired'].includes(booking.deposit_status)
    const isTerminalBookingState = ['cancelled', 'completed'].includes(booking.status)

    if (isTerminalDepositState || isTerminalBookingState || booking.status === 'confirmed') {
        return { ok: true, kind: 'booking', state: 'already_finalized' as const, booking }
    }

    const provider = normalizePaymentProvider(options.provider)
    const resolvedProviderTxId = resolveProviderTransactionId(provider, reference, options.providerPayload)
    const bookingUpdate: Record<string, unknown> = {
        deposit_status: 'paid',
        payment_provider: provider,
        status: 'confirmed',
        updated_at: new Date().toISOString(),
    }

    if (resolvedProviderTxId) {
        bookingUpdate.provider_transaction_id = resolvedProviderTxId
    }

    const { data: updatedBookings, error: updateError } = await supabase
        .from('bookings')
        .update(bookingUpdate)
        .eq('id', booking.id)
        .eq('status', booking.status)
        .eq('deposit_status', booking.deposit_status)
        .select('id, status, deposit_status')

    if (updateError) {
        console.error('[Hosted Checkout Finalization] Failed to update booking:', updateError)
        return { ok: false, kind: 'booking', state: 'error' as const, error: updateError }
    }

    if (!updatedBookings || updatedBookings.length === 0) {
        const { data: latestBooking } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', booking.id)
            .single()

        return {
            ok: true,
            kind: 'booking',
            state: 'already_finalized' as const,
            booking: latestBooking || booking,
        }
    }

    await clearRestaurantConversationState(supabase, booking.conversation_id)

    try {
        const chargedAmount = Number(booking.deposit_amount_fcfa || options.amount || 0)
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
        const paymentLabel = isFullServiceBookingPayment(booking) ? 'Paiement' : 'Acompte'
        const confirmationMessage = `*${paymentLabel} recu !*\n\nMerci ! Votre ${paymentLabel.toLowerCase()} de ${chargedAmount.toLocaleString('fr-FR')} FCFA pour la reservation ${serviceName}${dateStr ? ` le ${dateStr}` : ''} a ete confirme.\n\nVotre reservation est maintenant confirmee.\n\nMerci pour votre confiance !`

        await queueAssistantMessage(
            supabase,
            booking.agent_id,
            booking.conversation_id,
            booking.customer_phone,
            confirmationMessage
        )
    } catch (notifyError) {
        console.error('[Hosted Checkout Finalization] Failed to send booking confirmation:', notifyError)
    }

    return { ok: true, kind: 'booking', state: 'finalized' as const, bookingId: booking.id }
}

export async function finalizeHostedCheckoutTransaction(
    supabase: SupabaseClientLike,
    reference: string,
    options: {
        provider: SupportedPaymentProvider
        amount?: number | null
        providerPayload?: unknown
    }
) {
    if (isOrderTransactionId(reference)) {
        return finalizeHostedOrderPayment(supabase, reference, options)
    }

    if (isBookingTransactionId(reference)) {
        return finalizeHostedBookingPayment(supabase, reference, options)
    }

    return { ok: false, kind: 'unknown', state: 'not_found' as const }
}
