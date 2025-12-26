import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for webhook (no user auth)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        console.log('📩 CinetPay Webhook received:', JSON.stringify(body, null, 2))

        const {
            cpm_trans_id,
            cpm_site_id,
            cpm_trans_status,
            cpm_amount,
            cpm_currency,
            cpm_payment_config,
            cpm_phone_prefixe,
            cpm_error_message,
            cpm_custom
        } = body

        // Verify site_id
        if (cpm_site_id !== process.env.CINETPAY_SITE_ID) {
            console.error('❌ Invalid site_id in webhook')
            return new Response('Invalid site_id', { status: 400 })
        }

        // Find the payment record
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('transaction_id', cpm_trans_id)
            .single()

        if (paymentError || !payment) {
            console.error('❌ Payment not found:', cpm_trans_id)
            return new Response('Payment not found', { status: 404 })
        }

        // Update payment status
        const newStatus = cpm_trans_status === 'ACCEPTED' ? 'completed' :
            cpm_trans_status === 'REFUSED' ? 'failed' : 'pending'

        await supabase
            .from('payments')
            .update({
                status: newStatus,
                metadata: JSON.stringify({
                    ...JSON.parse(payment.metadata || '{}'),
                    cinetpay_response: body
                })
            })
            .eq('id', payment.id)

        // If payment successful, credit user account
        if (cpm_trans_status === 'ACCEPTED') {
            console.log('✅ Payment successful, crediting user:', payment.user_id)

            const creditsToAdd = payment.credits_purchased

            // Get current balance
            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_balance')
                .eq('id', payment.user_id)
                .single()

            const currentBalance = profile?.credits_balance || 0

            // Update credits
            await supabase
                .from('profiles')
                .update({
                    credits_balance: currentBalance + creditsToAdd
                })
                .eq('id', payment.user_id)

            console.log(`✅ Added ${creditsToAdd} credits to user ${payment.user_id}`)
        }

        return new Response('OK', { status: 200 })
    } catch (err) {
        console.error('❌ Webhook error:', err)
        return new Response('Internal error', { status: 500 })
    }
}

// Also handle GET for verification
export async function GET(request: NextRequest) {
    return new Response('CinetPay Webhook Endpoint Active', { status: 200 })
}
