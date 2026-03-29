import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkPaymentStatus, verifyWebhookSignature } from '@/lib/payments/cinetpay'
import { notify } from '@/lib/notifications/notification.service'
import { finalizePaymentByTransaction } from '@/lib/payments/finalization'

// Use service role for webhook (no user auth)
// Helper for lazy init
const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// HMAC Signature Verification for CinetPay
function verifySignature(payload: string, signature: string): boolean {
    return verifyWebhookSignature(payload, signature)
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

export async function POST(request: NextRequest) {
    try {

        // CinetPay webhook fields (per official documentation)
        let cpm_site_id = ''
        let cpm_trans_id = ''
        let cpm_trans_date = ''
        let cpm_amount = ''
        let cpm_currency = ''
        let signature = ''
        let payment_method = ''
        let cel_phone_num = ''
        let cpm_phone_prefixe = ''
        let cpm_language = ''
        let cpm_version = ''
        let cpm_payment_config = ''
        let cpm_page_action = ''
        let cpm_custom = ''
        let cpm_designation = ''
        let cpm_error_message = ''

        const contentType = request.headers.get('content-type') || ''

        // Parse all fields from the request
        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData()
            cpm_site_id = formData.get('cpm_site_id')?.toString() || ''
            cpm_trans_id = formData.get('cpm_trans_id')?.toString() || ''
            cpm_trans_date = formData.get('cpm_trans_date')?.toString() || ''
            cpm_amount = formData.get('cpm_amount')?.toString() || ''
            cpm_currency = formData.get('cpm_currency')?.toString() || ''
            signature = formData.get('signature')?.toString() || ''
            payment_method = formData.get('payment_method')?.toString() || ''
            cel_phone_num = formData.get('cel_phone_num')?.toString() || ''
            cpm_phone_prefixe = formData.get('cpm_phone_prefixe')?.toString() || ''
            cpm_language = formData.get('cpm_language')?.toString() || ''
            cpm_version = formData.get('cpm_version')?.toString() || ''
            cpm_payment_config = formData.get('cpm_payment_config')?.toString() || ''
            cpm_page_action = formData.get('cpm_page_action')?.toString() || ''
            cpm_custom = formData.get('cpm_custom')?.toString() || ''
            cpm_designation = formData.get('cpm_designation')?.toString() || ''
            cpm_error_message = formData.get('cpm_error_message')?.toString() || ''
        } else if (contentType.includes('application/json')) {
            const body = await request.json()
            cpm_site_id = body.cpm_site_id || ''
            cpm_trans_id = body.cpm_trans_id || ''
            cpm_trans_date = body.cpm_trans_date || ''
            cpm_amount = body.cpm_amount || ''
            cpm_currency = body.cpm_currency || ''
            signature = body.signature || ''
            payment_method = body.payment_method || ''
            cel_phone_num = body.cel_phone_num || ''
            cpm_phone_prefixe = body.cpm_phone_prefixe || ''
            cpm_language = body.cpm_language || ''
            cpm_version = body.cpm_version || ''
            cpm_payment_config = body.cpm_payment_config || ''
            cpm_page_action = body.cpm_page_action || ''
            cpm_custom = body.cpm_custom || ''
            cpm_designation = body.cpm_designation || ''
            cpm_error_message = body.cpm_error_message || ''
        } else {
            const text = await request.text()
            const params = new URLSearchParams(text)
            cpm_site_id = params.get('cpm_site_id') || ''
            cpm_trans_id = params.get('cpm_trans_id') || ''
            cpm_trans_date = params.get('cpm_trans_date') || ''
            cpm_amount = params.get('cpm_amount') || ''
            cpm_currency = params.get('cpm_currency') || ''
            signature = params.get('signature') || ''
            payment_method = params.get('payment_method') || ''
            cel_phone_num = params.get('cel_phone_num') || ''
            cpm_phone_prefixe = params.get('cpm_phone_prefixe') || ''
            cpm_language = params.get('cpm_language') || ''
            cpm_version = params.get('cpm_version') || ''
            cpm_payment_config = params.get('cpm_payment_config') || ''
            cpm_page_action = params.get('cpm_page_action') || ''
            cpm_custom = params.get('cpm_custom') || ''
            cpm_designation = params.get('cpm_designation') || ''
            cpm_error_message = params.get('cpm_error_message') || ''
        }

        if (!cpm_trans_id) {
            console.error('[Webhook] No transaction ID received')
            return new Response('Missing cpm_trans_id', { status: 400 })
        }

        // SECURITY: Verify HMAC signature from x-token header (Strict Fail-Closed)
        const xToken = request.headers.get('x-token')

        if (!xToken) {
            console.warn(`[Webhook] Missing x-token header from ${request.headers.get('x-forwarded-for') || 'unknown IP'} — rejecting`)
            return new Response('Missing x-token header', { status: 401 })
        }

        // FAIL-CLOSED : si la clé est absente, refuser tout webhook
        if (!process.env.CINETPAY_SECRET_KEY) {
            console.error('[Webhook] CINETPAY_SECRET_KEY non configurée — webhook rejeté (fail-closed)')
            return new Response('Webhook not configured', { status: 500 })
        }

        // Official CinetPay HMAC format: concatenate all 16 fields
        const signaturePayload = cpm_site_id + cpm_trans_id + cpm_trans_date + cpm_amount +
            cpm_currency + signature + payment_method + cel_phone_num + cpm_phone_prefixe +
            cpm_language + cpm_version + cpm_payment_config + cpm_page_action +
            cpm_custom + cpm_designation + cpm_error_message

        if (!verifySignature(signaturePayload, xToken)) {
            console.warn('[Webhook] Invalid x-token signature — rejecting')
            return new Response('Invalid signature', { status: 403 })
        }

        // Verify site_id matches our configuration
        if (cpm_site_id && cpm_site_id !== process.env.CINETPAY_SITE_ID) {
            return new Response('Invalid site_id', { status: 400 })
        }

        // First, check if this is an ORDER payment (transaction_id starts with ORD_)
        if (cpm_trans_id.startsWith('ORD_')) {

            const { data: order, error: _orderError } = await getSupabase()
                .from('orders')
                .select('*')
                .eq('transaction_id', cpm_trans_id)
                .single()

            if (order) {
                // IDEMPOTENCY CHECK: If already paid, stop here
                if (order.status === 'paid' || order.status === 'completed') {
                    return new Response('OK', { status: 200 })
                }

                // Verify with CinetPay API
                const cinetpayStatus = await checkPaymentStatus(cpm_trans_id)

                if (cinetpayStatus.status === 'ACCEPTED') {
                    // Update order status to paid
                    const { error: updateError } = await getSupabase().from('orders').update({
                        status: 'paid'
                    }).eq('id', order.id)

                    if (!updateError) {
                        // 📦 Digital delivery: auto-send digital content if applicable
                        try {
                            const { deliverDigitalProducts } = await import('@/lib/payments/digital-delivery')
                            await deliverDigitalProducts(order.id, getSupabase())
                        } catch (deliveryErr) {
                            console.error('[Webhook] Digital delivery error (non-blocking):', deliveryErr)
                        }

                        // Send WhatsApp notification to client
                        try {
                            const confirmationMessage = `*Paiement recu !*\n\nMerci ! Votre paiement de ${order.total_fcfa?.toLocaleString('fr-FR')} FCFA pour la commande #${order.id.substring(0, 8)} a ete confirme.\n\nVotre commande est maintenant en cours de traitement.\n\nMerci pour votre confiance !`

                            // HYBRID ROUTING: Check for active conversation
                            // STRATEGY: 1. Try Hard Link (conversation_id) -> 2. Try Soft Link (agent + phone)
                            const conversationId = order.conversation_id
                            let conversation = null

                            if (conversationId) {
                                // Verify it still exists
                                const { data: linkedConv } = await getSupabase()
                                    .from('conversations')
                                    .select('id')
                                    .eq('id', conversationId)
                                    .single()
                                if (linkedConv) conversation = linkedConv
                            }

                            if (!conversation) {
                                // Fallback: Soft Link (Legacy/Backup)
                                const { data: softConv } = await getSupabase()
                                    .from('conversations')
                                    .select('id')
                                    .eq('agent_id', order.agent_id)
                                    .eq('contact_phone', order.customer_phone)
                                    .single()
                                conversation = softConv
                            }

                            let messageInsertedSuccessfully = false

                            if (conversation) {
                                // Resolve agent_id: order.agent_id is nullable, conversation.agent_id is NOT NULL
                                let resolvedAgentId = order.agent_id
                                if (!resolvedAgentId) {
                                    // Fallback: get agent_id from conversation
                                    const { data: convData } = await getSupabase()
                                        .from('conversations')
                                        .select('agent_id')
                                        .eq('id', conversation.id)
                                        .single()
                                    resolvedAgentId = convData?.agent_id || null
                                }

                                if (resolvedAgentId) {
                                    // CASE 1: Conversation exists -> Insert into history
                                    const { data: insertedMsg, error: insertErr } = await getSupabase().from('messages').insert({
                                        conversation_id: conversation.id,
                                        agent_id: resolvedAgentId,
                                        role: 'assistant',
                                        content: confirmationMessage,
                                        status: 'pending' // Will be picked up by checkPendingMessages
                                    }).select().single()

                                    if (insertErr) {
                                        console.error('[Webhook] Failed to insert message:', insertErr)
                                    } else {
                                        console.log('[Webhook] Message inserted with ID:', insertedMsg?.id)
                                        messageInsertedSuccessfully = true

                                        // Update conversation header
                                        await getSupabase().from('conversations').update({
                                            last_message_text: confirmationMessage.substring(0, 200),
                                            last_message_at: new Date().toISOString(),
                                            last_message_role: 'assistant'
                                        }).eq('id', conversation.id)

                                        console.log('[Webhook] Payment confirmation added to conversation history for:', order.customer_phone)
                                    }
                                }

                                // FALLBACK: Always queue to outbound_messages if message insertion failed or no conversation
                                // This ensures the message is sent even if the bot is offline when webhook is received
                                if (!messageInsertedSuccessfully && resolvedAgentId) {
                                    console.log('[Webhook] Inserting message into outbound_messages table (fallback)...')
                                    const { data: outboundMsg, error: outboundErr } = await getSupabase().from('outbound_messages').insert({
                                        agent_id: resolvedAgentId,
                                        recipient_phone: order.customer_phone,
                                        message_content: confirmationMessage,
                                        status: 'pending'
                                    }).select().single()

                                    if (outboundErr) {
                                        console.error('[Webhook] Failed to insert outbound message:', outboundErr)
                                    } else {
                                        console.log('[Webhook] Outbound message inserted with ID:', outboundMsg?.id)
                                    }
                                    console.log('[Webhook] Payment confirmation queued via outbound_messages for:', order.customer_phone)
                                }

                                // 4. (Bonus) Notifier le merchant
                                try {
                                    // Retrieve merchant phone from profiles table
                                    const { data: agentData } = await getSupabase()
                                        .from('agents')
                                        .select('user_id')
                                        .eq('id', order.agent_id)
                                        .single()

                                    if (agentData) {
                                        const { data: profile } = await getSupabase()
                                            .from('profiles')
                                            .select('phone')
                                            .eq('id', agentData.user_id)
                                            .single()

                                        // Default phone if missing on profile
                                        const merchantPhone = profile?.phone

                                        const itemsList = await getSupabase()
                                            .from('order_items')
                                            .select('product_name, quantity, unit_price_fcfa')
                                            .eq('order_id', order.id)
                                        const itemsSummary = itemsList.data?.map((i: any) => `- ${i.quantity}x ${i.product_name}`).join('\n') || 'Articles divers'

                                        await getSupabase().from('outbound_messages').insert({
                                            agent_id: resolvedAgentId || order.agent_id,
                                            recipient_phone: merchantPhone,
                                            message_content: `*NOUVEAU PAIEMENT !*\n\nMontant: ${Number(order.total_fcfa).toLocaleString()} FCFA\nCommande: #${order.id.substring(0, 8)}\nClient: ${order.customer_phone}\n\nArticles:\n${itemsSummary}\n\nMode: CinetPay`,
                                            status: 'pending'
                                        })
                                        console.log('[Webhook] Merchant notification queued for:', merchantPhone)

                                        // 5. Send push + email notification to business owner
                                        await notify(agentData.user_id, 'payment_received', {
                                            orderNumber: order.id,
                                            customerName: order.customer_name || order.customer_phone,
                                            paymentAmount: Number(order.total_fcfa),
                                            paymentMethod: 'CinetPay'
                                        })
                                        console.log('[Webhook] Push/email notification sent for payment')
                                    }
                                } catch (notifyError) {
                                    console.error('Failed to notify merchant:', notifyError)
                                }
                            } // close if (conversation)
                        } catch (notifyErr) {
                            console.error('[Webhook] Failed to send WhatsApp notification:', notifyErr)
                        }
                    }
                } else if (cinetpayStatus.status === 'REFUSED' || cinetpayStatus.status === 'CANCELLED') {
                    await getSupabase().from('orders').update({
                        status: 'cancelled'
                    }).eq('id', order.id)
                    console.log('[Webhook] Order payment REFUSED/CANCELLED')
                } else {
                    console.log('[Webhook] Order payment status pending:', cinetpayStatus.status)
                }

                return new Response('OK', { status: 200 })
            } else {
                console.error('[Webhook] ORDER NOT FOUND! transaction_id:', cpm_trans_id)
                console.error('   This means the order was not saved with this transaction_id.')
                console.error('   Check if /api/public/orders/[orderId]/pay saved the transaction_id correctly.')
            }
        }

        if (cpm_trans_id.startsWith('BKG_')) {
            const { data: booking } = await getSupabase()
                .from('bookings')
                .select('*')
                .eq('transaction_id', cpm_trans_id)
                .single()

            if (booking) {
                if (booking.deposit_status === 'paid' || booking.status === 'confirmed') {
                    return new Response('OK', { status: 200 })
                }

                const cinetpayStatus = await checkPaymentStatus(cpm_trans_id)

                if (cinetpayStatus.status === 'ACCEPTED') {
                    const { error: updateError } = await getSupabase()
                        .from('bookings')
                        .update({
                            deposit_status: 'paid',
                            status: 'confirmed',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', booking.id)

                    if (!updateError) {
                        try {
                            const amount = Number(booking.deposit_amount_fcfa || cinetpayStatus.amount || 0)
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
                            const confirmationMessage = `*Acompte recu !*\n\nMerci ! Votre acompte de ${amount.toLocaleString('fr-FR')} FCFA pour la reservation ${serviceName}${dateStr ? ` le ${dateStr}` : ''} a ete confirme.\n\nVotre reservation est maintenant confirmee.\n\nMerci pour votre confiance !`

                            await queueAssistantMessage(
                                booking.agent_id,
                                booking.conversation_id,
                                booking.customer_phone,
                                confirmationMessage
                            )
                        } catch (notifyErr) {
                            console.error('[Webhook] Failed to send booking confirmation:', notifyErr)
                        }
                    }
                } else if (cinetpayStatus.status === 'REFUSED' || cinetpayStatus.status === 'CANCELLED') {
                    await getSupabase()
                        .from('bookings')
                        .update({
                            deposit_status: 'expired',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', booking.id)
                    console.log('[Webhook] Booking deposit REFUSED/CANCELLED')
                    try {
                        const failMessage = `*Paiement non abouti*\n\nNous n'avons pas pu traiter votre acompte pour la reservation ${booking.service_name || ''}. Votre reservation n'est pas confirmee.\n\nVeuillez reessayer ou contacter notre equipe.`
                        await queueAssistantMessage(booking.agent_id, booking.conversation_id, booking.customer_phone, failMessage)
                    } catch (_e) { }
                } else {
                    console.log('[Webhook] Booking deposit status pending:', cinetpayStatus.status)
                }

                return new Response('OK', { status: 200 })
            } else {
                console.error('[Webhook] BOOKING NOT FOUND! transaction_id:', cpm_trans_id)
                console.error('   Check if /api/payments/cinetpay/booking-initiate saved the transaction_id correctly.')
            }
        }
        // Credits/subscriptions finalization goes through shared pipeline.
        const cinetpayStatus = await checkPaymentStatus(cpm_trans_id)

        if (!cinetpayStatus.success) {
            console.error('[Webhook] Failed to verify with CinetPay:', cinetpayStatus.message)
            return new Response('OK', { status: 200 }) // Return OK to stop retries
        }

        const finalized = await finalizePaymentByTransaction(
            getSupabase(),
            cpm_trans_id,
            cinetpayStatus.status,
            {
                cpm_site_id,
                cpm_trans_id,
                cpm_trans_date,
                cpm_amount,
                cpm_currency,
                signature,
                payment_method,
                cel_phone_num,
                cpm_phone_prefixe,
                cpm_language,
                cpm_version,
                cpm_payment_config,
                cpm_page_action,
                cpm_custom,
                cpm_designation,
                cpm_error_message,
            }
        )

        if (!finalized.ok && finalized.state !== 'not_found') {
            console.error('[Webhook] Finalization failed:', finalized.message)
        }

        return new Response('OK', { status: 200 }) // Return OK to stop retries

    } catch (err) {
        console.error('[Webhook] Webhook error:', err)
        return new Response('OK', { status: 200 }) // Return OK to stop retries
    }
}

// GET for testing availability
export async function GET(_request: NextRequest) {
    return new Response('CinetPay Webhook Endpoint Active', { status: 200 })
}
