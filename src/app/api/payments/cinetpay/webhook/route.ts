import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkPaymentStatus } from '@/lib/payments/cinetpay'

// Use service role for webhook (no user auth)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        console.log('📩 CinetPay Webhook called!')
        console.log('Content-Type:', request.headers.get('content-type'))

        // CinetPay sends x-www-form-urlencoded, NOT JSON!
        let cpm_trans_id: string = ''
        let cpm_site_id: string = ''

        const contentType = request.headers.get('content-type') || ''

        if (contentType.includes('application/x-www-form-urlencoded')) {
            // Parse form data
            const formData = await request.formData()
            cpm_trans_id = formData.get('cpm_trans_id')?.toString() || ''
            cpm_site_id = formData.get('cpm_site_id')?.toString() || ''
            console.log('📋 Form data - trans_id:', cpm_trans_id, 'site_id:', cpm_site_id)
        } else if (contentType.includes('application/json')) {
            // Fallback to JSON parsing
            const body = await request.json()
            cpm_trans_id = body.cpm_trans_id || ''
            cpm_site_id = body.cpm_site_id || ''
            console.log('📋 JSON data - trans_id:', cpm_trans_id, 'site_id:', cpm_site_id)
        } else {
            // Try to read as text and parse
            const text = await request.text()
            console.log('📋 Raw text:', text)
            const params = new URLSearchParams(text)
            cpm_trans_id = params.get('cpm_trans_id') || ''
            cpm_site_id = params.get('cpm_site_id') || ''
        }

        if (!cpm_trans_id) {
            console.error('❌ No transaction ID received')
            return new Response('Missing cpm_trans_id', { status: 400 })
        }

        // Verify site_id
        if (cpm_site_id && cpm_site_id !== process.env.CINETPAY_SITE_ID) {
            console.error('❌ Invalid site_id:', cpm_site_id, 'expected:', process.env.CINETPAY_SITE_ID)
            return new Response('Invalid site_id', { status: 400 })
        }

        // First, check if this is an ORDER payment (transaction_id starts with ORD_)
        if (cpm_trans_id.startsWith('ORD_')) {
            console.log('📦 This is an ORDER payment, checking orders table...')

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .select('*')
                .eq('transaction_id', cpm_trans_id)
                .single()

            if (order) {
                console.log('✅ Found order:', order.id, 'status:', order.status)

                // Verify with CinetPay API
                const cinetpayStatus = await checkPaymentStatus(cpm_trans_id)
                console.log('📡 CinetPay API response:', JSON.stringify(cinetpayStatus))

                if (cinetpayStatus.status === 'ACCEPTED') {
                    // Update order status to paid
                    const { error: updateError } = await supabase.from('orders').update({
                        status: 'paid'
                    }).eq('id', order.id)

                    if (updateError) {
                        console.error('❌ Failed to update order:', updateError)
                    } else {
                        console.log('✅ Order marked as PAID!')
                    }
                } else if (cinetpayStatus.status === 'REFUSED' || cinetpayStatus.status === 'CANCELLED') {
                    await supabase.from('orders').update({
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
        const { data: payment, error: paymentError } = await supabase
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
                // Get current balance
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('credits_balance, plan')
                    .eq('id', payment.user_id)
                    .single()

                const currentBalance = profile?.credits_balance || 0
                const newBalance = currentBalance + creditsToAdd

                // Update profile with new credits
                const updateData: { credits_balance: number; plan?: string } = {
                    credits_balance: newBalance
                }

                // Update plan if subscription payment
                if (payment.payment_type === 'subscription') {
                    const metadata = payment.provider_response
                    if (creditsToAdd >= 5000) {
                        updateData.plan = 'business'
                    } else if (creditsToAdd >= 3000) {
                        updateData.plan = 'pro'
                    } else if (creditsToAdd >= 1000) {
                        updateData.plan = 'starter'
                    }
                }

                await supabase
                    .from('profiles')
                    .update(updateData)
                    .eq('id', payment.user_id)

                console.log(`✅ SUCCESS! Added ${creditsToAdd} credits. Balance: ${currentBalance} → ${newBalance}`)
            }

            // Mark payment as completed
            await supabase
                .from('payments')
                .update({
                    status: 'completed',
                    credits_purchased: creditsToAdd,
                    completed_at: new Date().toISOString()
                })
                .eq('id', payment.id)

        } else if (cinetpayStatus.status === 'REFUSED' || cinetpayStatus.status === 'CANCELLED') {
            // Mark as failed
            await supabase
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
export async function GET(request: NextRequest) {
    return new Response('CinetPay Webhook Endpoint Active', { status: 200 })
}
