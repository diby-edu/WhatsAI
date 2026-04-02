import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notify } from '@/lib/notifications/notification.service'
import { finalizePaymentByTransaction } from '@/lib/payments/finalization'
import { verifyPaystackTransaction, verifyPaystackWebhookSignature } from '@/lib/payments/paystack'

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isOrderTransactionId(transactionId: string) {
    return transactionId.startsWith('ORD_') || transactionId.startsWith('ORD-')
}

function isBookingTransactionId(transactionId: string) {
    return transactionId.startsWith('BKG_') || transactionId.startsWith('BKG-')
}

async function queueAssistantMessage(
    agentId: string | null | undefined,
    conversationId: string | null | undefined,
    customerPhone: string,
    message: string
) {
    if (!agentId || !customerPhone) {
        return
    }

    let conversation: { id: string } | null = null

    if (conversationId) {
        const { data: linkedConversation } = await getSupabase()
            .from('conversations')
            .select('id')
            .eq('id', conversationId)
            .single()
        if (linkedConversation) {
            conversation = linkedConversation
        }
    }

    if (!conversation) {
        const { data: fallbackConversation } = await getSupabase()
            .from('conversations')
            .select('id')
            .eq('agent_id', agentId)
            .eq('contact_phone', customerPhone)
            .single()
        conversation = fallbackConversation
    }

    let insertedInHistory = false

    if (conversation) {
        const { error: insertError } = await getSupabase()
            .from('messages')
            .insert({
                conversation_id: conversation.id,
                agent_id: agentId,
                role: 'assistant',
                content: message,
                status: 'pending'
            })

        if (!insertError) {
            insertedInHistory = true
            await getSupabase()
                .from('conversations')
                .update({
                    last_message_text: message.substring(0, 200),
                    last_message_at: new Date().toISOString(),
                    last_message_role: 'assistant'
                })
                .eq('id', conversation.id)
        }
    }

    if (!insertedInHistory) {
        await getSupabase()
            .from('outbound_messages')
            .insert({
                agent_id: agentId,
                recipient_phone: customerPhone,
                message_content: message,
                status: 'pending'
            })
    }
}

async function clearRestaurantConversationState(conversationId: string | null | undefined) {
    if (!conversationId) {
        return
    }

    const { data: conversation } = await getSupabase()
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .single()

    if (!conversation?.metadata?.restaurant) {
        return
    }

    await getSupabase()
        .from('conversations')
        .update({
            metadata: {
                ...conversation.metadata,
                restaurant: null,
            }
        })
        .eq('id', conversationId)
}

async function notifyMerchantOrderPayment(order: any, providerLabel: string) {
    try {
        const { data: agentData } = await getSupabase()
            .from('agents')
            .select('user_id')
            .eq('id', order.agent_id)
            .single()

        if (!agentData) {
            return
        }

        const { data: profile } = await getSupabase()
            .from('profiles')
            .select('phone')
            .eq('id', agentData.user_id)
            .single()

        const merchantPhone = profile?.phone
        if (!merchantPhone) {
            return
        }

        const itemsList = await getSupabase()
            .from('order_items')
            .select('product_name, quantity')
            .eq('order_id', order.id)

        const itemsSummary = itemsList.data?.map((item: any) => `- ${item.quantity}x ${item.product_name}`).join('\n') || 'Articles divers'

        await getSupabase().from('outbound_messages').insert({
            agent_id: order.agent_id,
            recipient_phone: merchantPhone,
            message_content: `*NOUVEAU PAIEMENT !*\n\nMontant: ${Number(order.total_fcfa || 0).toLocaleString('fr-FR')} FCFA\nCommande: #${order.id.substring(0, 8)}\nClient: ${order.customer_phone}\n\nArticles:\n${itemsSummary}\n\nMode: ${providerLabel}`,
            status: 'pending'
        })

        await notify(agentData.user_id, 'payment_received', {
            orderNumber: order.id,
            customerName: order.customer_name || order.customer_phone,
            paymentAmount: Number(order.total_fcfa || 0),
            paymentMethod: providerLabel
        })
    } catch (notifyError) {
        console.error('[Paystack Webhook] Failed to notify merchant:', notifyError)
    }
}

async function handleOrderPayment(reference: string, amount: number | null) {
    const { data: order } = await getSupabase()
        .from('orders')
        .select('*')
        .eq('transaction_id', reference)
        .single()

    if (!order) {
        return
    }

    if (order.status === 'paid' || order.status === 'completed') {
        return
    }

    const isRestaurantDepositPayment = order.deposit_required && order.deposit_status === 'pending'
    const nextStatus = isRestaurantDepositPayment
        ? (order.fulfillment_mode === 'delivery' ? 'pending_delivery' : 'pending_pickup')
        : 'paid'

    const orderUpdate: Record<string, unknown> = {
        status: nextStatus,
        payment_provider: 'paystack',
        updated_at: new Date().toISOString()
    }

    if (isRestaurantDepositPayment) {
        orderUpdate.deposit_status = 'paid'
    }

    const { error: updateError } = await getSupabase()
        .from('orders')
        .update(orderUpdate)
        .eq('id', order.id)

    if (updateError) {
        return
    }

    try {
        const { deliverDigitalProducts } = await import('@/lib/payments/digital-delivery')
        await deliverDigitalProducts(order.id, getSupabase())
    } catch (deliveryErr) {
        console.error('[Paystack Webhook] Digital delivery error (non-blocking):', deliveryErr)
    }

    try {
        const paidAmount = Number(
            isRestaurantDepositPayment
                ? (order.deposit_amount_fcfa || amount || 0)
                : (order.total_fcfa || amount || 0)
        )
        const confirmationMessage = isRestaurantDepositPayment
            ? `*Acompte recu !*\n\nMerci ! Votre acompte de ${paidAmount.toLocaleString('fr-FR')} FCFA pour la commande #${order.id.substring(0, 8)} a ete confirme.\n\nVotre commande est maintenant prise en charge.\n\nMerci pour votre confiance !`
            : `*Paiement recu !*\n\nMerci ! Votre paiement de ${paidAmount.toLocaleString('fr-FR')} FCFA pour la commande #${order.id.substring(0, 8)} a ete confirme.\n\nVotre commande est maintenant en cours de traitement.\n\nMerci pour votre confiance !`

        await queueAssistantMessage(
            order.agent_id,
            order.conversation_id,
            order.customer_phone,
            confirmationMessage
        )

        await notifyMerchantOrderPayment(order, 'Paystack')

        if (isRestaurantDepositPayment) {
            await clearRestaurantConversationState(order.conversation_id)
        }
    } catch (notifyErr) {
        console.error('[Paystack Webhook] Failed to send order confirmation:', notifyErr)
    }
}

async function handleBookingDeposit(reference: string, amount: number | null) {
    const { data: booking } = await getSupabase()
        .from('bookings')
        .select('*')
        .eq('transaction_id', reference)
        .single()

    if (!booking) {
        return
    }

    const isTerminalDepositState = ['paid', 'waived', 'expired'].includes(booking.deposit_status)
    const isTerminalBookingState = ['cancelled', 'completed'].includes(booking.status)

    if (isTerminalDepositState || isTerminalBookingState || booking.status === 'confirmed') {
        return
    }

    const { error: updateError } = await getSupabase()
        .from('bookings')
        .update({
            deposit_status: 'paid',
            payment_provider: 'paystack',
            status: 'confirmed',
            updated_at: new Date().toISOString()
        })
        .eq('id', booking.id)

    if (updateError) {
        return
    }

    await clearRestaurantConversationState(booking.conversation_id)

    try {
        const depositAmount = Number(booking.deposit_amount_fcfa || amount || 0)
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
        const confirmationMessage = `*Acompte recu !*\n\nMerci ! Votre acompte de ${depositAmount.toLocaleString('fr-FR')} FCFA pour la reservation ${serviceName}${dateStr ? ` le ${dateStr}` : ''} a ete confirme.\n\nVotre reservation est maintenant confirmee.\n\nMerci pour votre confiance !`

        await queueAssistantMessage(
            booking.agent_id,
            booking.conversation_id,
            booking.customer_phone,
            confirmationMessage
        )
    } catch (notifyErr) {
        console.error('[Paystack Webhook] Failed to send booking confirmation:', notifyErr)
    }
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature') || ''

    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
        return new Response('Invalid signature', { status: 401 })
    }

    try {
        const body = JSON.parse(rawBody || '{}')
        if (body?.event !== 'charge.success') {
            return new Response('OK', { status: 200 })
        }

        const reference = String(body?.data?.reference || '').trim()
        if (!reference) {
            return new Response('OK', { status: 200 })
        }

        const verified = await verifyPaystackTransaction(reference)
        if (!verified.success || verified.status !== 'ACCEPTED') {
            return new Response('OK', { status: 200 })
        }

        if (isOrderTransactionId(reference)) {
            await handleOrderPayment(reference, verified.amount ?? null)
            return new Response('OK', { status: 200 })
        }

        if (isBookingTransactionId(reference)) {
            await handleBookingDeposit(reference, verified.amount ?? null)
            return new Response('OK', { status: 200 })
        }

        const finalized = await finalizePaymentByTransaction(
            getSupabase(),
            reference,
            verified.status,
            body
        )

        if (!finalized.ok && finalized.state !== 'not_found') {
            console.error('[Paystack Webhook] Finalization failed:', finalized.message)
        }

        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('[Paystack Webhook] Unexpected error:', error)
        return new Response('OK', { status: 200 })
    }
}

export async function GET() {
    return new Response('Paystack webhook ready', { status: 200 })
}
