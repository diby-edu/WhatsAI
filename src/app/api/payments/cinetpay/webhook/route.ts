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
        } = body

        // Verify site_id
        if (cpm_site_id !== process.env.CINETPAY_SITE_ID) {
            console.error('❌ Invalid site_id in webhook:', cpm_site_id, 'expected:', process.env.CINETPAY_SITE_ID)
            return new Response('Invalid site_id', { status: 400 })
        }

        // Find the payment record - check both field names for compatibility
        let payment = null

        // Try provider_transaction_id first (new API)
        const { data: paymentData, error: paymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('provider_transaction_id', cpm_trans_id)
            .single()

        if (paymentData) {
            payment = paymentData
        } else {
            // Fallback to transaction_id (old API from cinetpay/initiate)
            const { data: paymentData2 } = await supabase
                .from('payments')
                .select('*')
                .eq('transaction_id', cpm_trans_id)
                .single()
            payment = paymentData2
        }

        if (!payment) {
            console.error('❌ Payment not found for transaction:', cpm_trans_id)
            return new Response('Payment not found', { status: 404 })
        }

        console.log('✅ Found payment record:', payment.id, 'user:', payment.user_id)

        // Update payment status
        const newStatus = cpm_trans_status === 'ACCEPTED' ? 'completed' :
            cpm_trans_status === 'REFUSED' ? 'failed' : 'pending'

        const { error: updateError } = await supabase
            .from('payments')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', payment.id)

        if (updateError) {
            console.error('❌ Failed to update payment:', updateError)
        }

        // If payment successful, credit user account
        if (cpm_trans_status === 'ACCEPTED') {
            console.log('✅ Payment ACCEPTED, crediting user:', payment.user_id)

            // Determine credits to add from amount (1 credit per 10 FCFA, or from plan)
            let creditsToAdd = payment.credits_purchased || 0

            // If no credits_purchased, check if there's a plan in metadata
            if (!creditsToAdd && payment.payment_type === 'subscription') {
                // For subscriptions, get credits from the plan
                try {
                    // Parse metadata to get plan credits
                    const metadata = typeof payment.metadata === 'string'
                        ? JSON.parse(payment.metadata)
                        : payment.metadata

                    if (metadata?.credits) {
                        creditsToAdd = metadata.credits
                    }
                } catch (e) {
                    console.error('Failed to parse metadata:', e)
                }

                // If still no credits, fetch from plan
                if (!creditsToAdd) {
                    // Fallback: calculate from amount (1 credit per 10 FCFA)
                    creditsToAdd = Math.floor((payment.amount_fcfa || cpm_amount || 0) / 10)
                }
            }

            // For credit packs, use credits_purchased or calculate
            if (!creditsToAdd) {
                creditsToAdd = payment.credits_purchased || Math.floor((payment.amount_fcfa || cpm_amount) / 10)
            }

            console.log(`📊 Credits to add: ${creditsToAdd}`)

            if (creditsToAdd > 0) {
                // Get current balance
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('credits_balance')
                    .eq('id', payment.user_id)
                    .single()

                if (profileError) {
                    console.error('❌ Profile not found:', profileError)
                    return new Response('OK', { status: 200 })
                }

                const currentBalance = profile?.credits_balance || 0
                const newBalance = currentBalance + creditsToAdd

                // Update credits
                const { error: creditError } = await supabase
                    .from('profiles')
                    .update({
                        credits_balance: newBalance
                    })
                    .eq('id', payment.user_id)

                if (creditError) {
                    console.error('❌ Failed to update credits:', creditError)
                } else {
                    console.log(`✅ SUCCESS! Added ${creditsToAdd} credits. Balance: ${currentBalance} → ${newBalance}`)
                }

                // Also update the payment record with credits added
                await supabase
                    .from('payments')
                    .update({ credits_purchased: creditsToAdd })
                    .eq('id', payment.id)
            } else {
                console.log('⚠️ No credits to add (amount: 0)')
            }
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
