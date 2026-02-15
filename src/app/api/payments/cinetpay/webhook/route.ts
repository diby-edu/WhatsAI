import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkPaymentStatus } from '@/lib/payments/cinetpay'
import { CreditsService } from '@/lib/whatsapp/services/credits.service'
import crypto from 'crypto'

// Use service role for webhook (no user auth)
// Helper for lazy init
const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// HMAC Signature Verification for CinetPay
function verifySignature(payload: string, signature: string): boolean {
    const secretKey = process.env.CINETPAY_SECRET_KEY
    if (!secretKey) {
        console.error('❌ [CRITICAL SECURITY] CINETPAY_SECRET_KEY not configured!')
        console.error('   Webhook rejected. You MUST configure this variable in .env.local')
        // Throwing/returning false here relies on the caller handling it, but the caller (POST) 
        // will get false and should reject.
        // Actually, verifySignature returns boolean.
        return false
    }

    const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payload, 'utf8')
        .digest('hex')

    // Timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        )
    } catch {
        return false
    }
}

export async function POST(request: NextRequest) {
    // ═══════════════════════════════════════════════════════════════
    // 🔍 DEBUG: Log EVERYTHING at the start to diagnose webhook issues
    // ═══════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════')
    console.log('📩 CinetPay Webhook called at:', new Date().toISOString())
    console.log('📍 Request URL:', request.url)
    console.log('📋 Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())))

    try {
        console.log('📩 Processing webhook...')

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

        console.log('📋 Webhook data - trans_id:', cpm_trans_id, 'site_id:', cpm_site_id, 'amount:', cpm_amount)

        if (!cpm_trans_id) {
            console.error('❌ No transaction ID received')
            return new Response('Missing cpm_trans_id', { status: 400 })
        }

        // SECURITY: Verify HMAC signature from x-token header (Official CinetPay format)
        // Payload = ALL 16 fields concatenated in order per documentation
        const xToken = request.headers.get('x-token')
        console.log('🔐 x-token present:', !!xToken)
        console.log('🔐 CINETPAY_SECRET_KEY configured:', !!process.env.CINETPAY_SECRET_KEY)

        if (xToken && process.env.CINETPAY_SECRET_KEY) {
            // Official CinetPay HMAC format: concatenate all 16 fields
            const signaturePayload = cpm_site_id + cpm_trans_id + cpm_trans_date + cpm_amount +
                cpm_currency + signature + payment_method + cel_phone_num + cpm_phone_prefixe +
                cpm_language + cpm_version + cpm_payment_config + cpm_page_action +
                cpm_custom + cpm_designation + cpm_error_message

            if (!verifySignature(signaturePayload, xToken)) {
                console.error('❌ SECURITY: Invalid HMAC signature! Rejecting webhook.')
                console.error('   x-token received:', xToken.substring(0, 20) + '...')
                console.error('   payload used:', signaturePayload.substring(0, 50) + '...')
                return new Response('Invalid signature', { status: 403 })
            }
            console.log('✅ HMAC Signature verified successfully')
        } else if (!xToken) {
            // 🔴 SECURITY: Reject webhooks without signature
            console.error('❌ SECURITY: Missing x-token header - rejecting webhook')
            console.error('   All CinetPay webhooks MUST include x-token for HMAC verification')
            return new Response('Missing x-token', { status: 403 })
        } else if (xToken && !process.env.CINETPAY_SECRET_KEY) {
            // 🔴 SECURITY: Reject if we can't verify
            console.error('❌ SECURITY: x-token received but CINETPAY_SECRET_KEY not configured')
            console.error('   Configure CINETPAY_SECRET_KEY in .env.local to verify webhooks')
            return new Response('Server not configured for signature verification', { status: 500 })
        }

        // Verify site_id matches our configuration
        if (cpm_site_id && cpm_site_id !== process.env.CINETPAY_SITE_ID) {
            console.error('❌ Invalid site_id:', cpm_site_id, 'expected:', process.env.CINETPAY_SITE_ID)
            return new Response('Invalid site_id', { status: 400 })
        }

        // First, check if this is an ORDER payment (transaction_id starts with ORD_)
        if (cpm_trans_id.startsWith('ORD_')) {
            console.log('📦 This is an ORDER payment, checking orders table...')

            const { data: order, error: _orderError } = await getSupabase()
                .from('orders')
                .select('*')
                .eq('transaction_id', cpm_trans_id)
                .single()

            if (order) {
                console.log('✅ Found order:', order.id, 'status:', order.status)

                // IDEMPOTENCY CHECK: If already paid, stop here
                if (order.status === 'paid' || order.status === 'completed') {
                    console.log('🛑 Order already paid/completed. Ignoring duplicate webhook.')
                    return new Response('OK', { status: 200 })
                }

                // Verify with CinetPay API
                const cinetpayStatus = await checkPaymentStatus(cpm_trans_id)
                console.log('📡 CinetPay API response:', JSON.stringify(cinetpayStatus))

                if (cinetpayStatus.status === 'ACCEPTED') {
                    // Update order status to paid
                    const { error: updateError } = await getSupabase().from('orders').update({
                        status: 'paid'
                    }).eq('id', order.id)

                    if (updateError) {
                        console.error('❌ Failed to update order:', updateError)
                    } else {
                        console.log('✅ Order marked as PAID!')

                        // Send WhatsApp notification to client
                        try {

                            const confirmationMessage = `✅ *Paiement reçu !*\n\nMerci ! Votre paiement de ${order.total_fcfa?.toLocaleString('fr-FR')} FCFA pour la commande #${order.id.substring(0, 8)} a été confirmé.\n\n📦 Votre commande est maintenant en cours de traitement.\n\nMerci pour votre confiance ! 🙏`

                            // 🎯 HYBRID ROUTING: Check for active conversation
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

                            console.log('🔍 Conversation lookup result:', conversation ? 'FOUND' : 'NOT FOUND')
                            console.log('   order.conversation_id:', conversationId)
                            console.log('   order.agent_id:', order.agent_id)
                            console.log('   order.customer_phone:', order.customer_phone)

                            let messageInsertedSuccessfully = false

                            if (conversation) {
                                // CASE 1: Conversation exists -> Insert into history (Smart)
                                console.log('📝 Inserting message into messages table...')
                                const { data: insertedMsg, error: insertErr } = await getSupabase().from('messages').insert({
                                    conversation_id: conversation.id,
                                    agent_id: order.agent_id,
                                    role: 'assistant',
                                    content: confirmationMessage,
                                    status: 'pending' // Will be picked up by checkPendingMessages
                                }).select().single()

                                if (insertErr) {
                                    console.error('❌ Failed to insert message:', insertErr)
                                } else {
                                    console.log('✅ Message inserted with ID:', insertedMsg?.id)
                                    messageInsertedSuccessfully = true

                                    // Update conversation header
                                    await getSupabase().from('conversations').update({
                                        last_message_text: confirmationMessage.substring(0, 200),
                                        last_message_at: new Date().toISOString(),
                                        last_message_role: 'assistant'
                                    }).eq('id', conversation.id)

                                    console.log('💬 Payment confirmation added to conversation history for:', order.customer_phone)
                                }
                            }

                            // FALLBACK: Always queue to outbound_messages if message insertion failed or no conversation
                            // This ensures the message is sent even if the bot is offline when webhook is received
                            if (!messageInsertedSuccessfully) {
                                console.log('📝 Inserting message into outbound_messages table (fallback)...')
                                const { data: outboundMsg, error: outboundErr } = await getSupabase().from('outbound_messages').insert({
                                    agent_id: order.agent_id,
                                    recipient_phone: order.customer_phone,
                                    message_content: confirmationMessage,
                                    status: 'pending'
                                }).select().single()

                                if (outboundErr) {
                                    console.error('❌ Failed to insert outbound message:', outboundErr)
                                } else {
                                    console.log('✅ Outbound message inserted with ID:', outboundMsg?.id)
                                }
                                console.log('📱 Payment confirmation queued via outbound_messages for:', order.customer_phone)
                            }

                            // 4. (Bonus) Notifier le merchant
                            try {
                                // Récupérer le numéro du merchant depuis la table profiles
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

                                    // Numéro par défaut ou celui du profil
                                    const merchantPhone = profile?.phone || '+2250554585927'

                                    const itemsList = await getSupabase()
                                        .from('order_items')
                                        .select('product_name, quantity, unit_price_fcfa')
                                        .eq('order_id', order.id)

                                    const itemsSummary = itemsList.data?.map((i: any) => `• ${i.quantity}x ${i.product_name}`).join('\n') || 'Articles divers'

                                    await getSupabase().from('outbound_messages').insert({
                                        agent_id: order.agent_id,
                                        recipient_phone: merchantPhone,
                                        message_content: `🔔 *NOUVEAU PAIEMENT !*\n\n💰 Montant: ${Number(order.total_fcfa).toLocaleString()} FCFA\n📦 Commande: #${order.id.substring(0, 8)}\n👤 Client: ${order.customer_phone}\n\n🛒 Articles:\n${itemsSummary}\n\n💳 Mode: CinetPay`,
                                        status: 'pending'
                                    })
                                    console.log('📤 Merchant notification queued for:', merchantPhone)
                                }
                            } catch (notifyError) {
                                console.error('Failed to notify merchant:', notifyError)
                            }
                        } catch (notifyErr) {
                            console.error('⚠️ Failed to send WhatsApp notification:', notifyErr)
                        }
                    }
                } else if (cinetpayStatus.status === 'REFUSED' || cinetpayStatus.status === 'CANCELLED') {
                    await getSupabase().from('orders').update({
                        status: 'cancelled'
                    }).eq('id', order.id)
                    console.log('❌ Order payment REFUSED/CANCELLED')
                } else {
                    console.log('⏳ Order payment status pending:', cinetpayStatus.status)
                }

                return new Response('OK', { status: 200 })
            } else {
                console.error('❌ ORDER NOT FOUND! transaction_id:', cpm_trans_id)
                console.error('   This means the order was not saved with this transaction_id.')
                console.error('   Check if /api/public/orders/[orderId]/pay saved the transaction_id correctly.')
            }
        }

        // Find payment by transaction ID (for credits/subscriptions)
        const { data: payment, error: paymentError } = await getSupabase()
            .from('payments')
            .select('*')
            .eq('provider_transaction_id', cpm_trans_id)
            .single()

        if (paymentError || !payment) {
            console.error('❌ Payment not found for transaction:', cpm_trans_id)
            return new Response('Payment not found', { status: 404 })
        }

        console.log('✅ Found payment:', payment.id, 'status:', payment.status)

        // IMPORTANT: Always call CinetPay API to verify the real status (as per documentation)
        console.log('🔍 Verifying payment status with CinetPay API...')
        const cinetpayStatus = await checkPaymentStatus(cpm_trans_id)
        console.log('📡 CinetPay API response:', JSON.stringify(cinetpayStatus))

        if (!cinetpayStatus.success) {
            console.error('❌ Failed to verify with CinetPay:', cinetpayStatus.message)
            return new Response('OK', { status: 200 }) // Return OK to stop retries
        }

        // If already completed, don't process again
        if (payment.status === 'completed') {
            console.log('⏭️ Payment already completed, skipping')
            return new Response('OK', { status: 200 })
        }

        // Process based on CinetPay status
        if (cinetpayStatus.status === 'ACCEPTED') {
            console.log('✅ Payment ACCEPTED, crediting user:', payment.user_id)

            // Get credits to add
            let creditsToAdd = payment.credits_purchased || 0

            if (!creditsToAdd) {
                // Try from provider_response (metadata)
                const metadata = payment.provider_response
                creditsToAdd = metadata?.credits || 0
            }

            if (!creditsToAdd) {
                // Fallback: calculate from amount
                creditsToAdd = Math.floor(payment.amount_fcfa / 10)
            }

            console.log('💰 Credits to add:', creditsToAdd)

            if (creditsToAdd > 0) {
                // ═══════════════════════════════════════════════════════════
                // ⭐ FIX SECURITY: ATOMIC UPDATE (v2.10)
                // ═══════════════════════════════════════════════════════════
                // Use the atomic service method (RPC) instead of select/update

                try {
                    const newBalance = await CreditsService.add(getSupabase(), payment.user_id, creditsToAdd)

                    // Update plan based on credits added (Business Logic)
                    // Note: This part is still non-atomic regarding plan switch, 
                    // but credit balance is safe.
                    const updateData: { plan?: string } = {}

                    if (payment.payment_type === 'subscription') {
                        if (creditsToAdd >= 5000) updateData.plan = 'business'
                        else if (creditsToAdd >= 3000) updateData.plan = 'pro'
                        else if (creditsToAdd >= 1000) updateData.plan = 'starter'

                        if (Object.keys(updateData).length > 0) {
                            await getSupabase()
                                .from('profiles')
                                .update(updateData)
                                .eq('id', payment.user_id)
                        }
                    }

                    console.log(`✅ SUCCESS! Added ${creditsToAdd} credits. New Balance: ${newBalance}`)

                } catch (creditError) {
                    console.error('❌ Failed to add credits atomicaly:', creditError)
                    // We don't fail the webhook response, but we log critically
                }
            }

            // Mark payment as completed
            await getSupabase()
                .from('payments')
                .update({
                    status: 'completed',
                    credits_purchased: creditsToAdd,
                    completed_at: new Date().toISOString()
                })
                .eq('id', payment.id)

        } else if (cinetpayStatus.status === 'REFUSED' || cinetpayStatus.status === 'CANCELLED') {
            // Mark as failed
            await getSupabase()
                .from('payments')
                .update({ status: 'failed' })
                .eq('id', payment.id)
            console.log('❌ Payment REFUSED/CANCELLED')
        } else {
            console.log('⏳ Payment status:', cinetpayStatus.status, '- waiting...')
        }

        return new Response('OK', { status: 200 })
    } catch (err) {
        console.error('❌ Webhook error:', err)
        return new Response('OK', { status: 200 }) // Return OK to stop retries
    }
}

// GET for testing availability
export async function GET(_request: NextRequest) {
    return new Response('CinetPay Webhook Endpoint Active', { status: 200 })
}
