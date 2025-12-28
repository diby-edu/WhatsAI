import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkPaymentStatus } from '@/lib/payments/cinetpay'

// Use service role for admin operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST - Check and update payment status from CinetPay
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { paymentId } = body

        console.log('🔍 Manual payment verification requested:', paymentId)

        // Get the payment record
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single()

        if (paymentError || !payment) {
            console.error('❌ Payment not found:', paymentId)
            return Response.json({ error: 'Payment not found' }, { status: 404 })
        }

        console.log('📋 Found payment:', payment.provider_transaction_id, 'status:', payment.status)

        // Check status with CinetPay API
        const transactionId = payment.provider_transaction_id
        const cinetpayStatus = await checkPaymentStatus(transactionId)

        console.log('📡 CinetPay response:', JSON.stringify(cinetpayStatus))

        if (!cinetpayStatus.success) {
            return Response.json({
                error: 'Failed to check payment status',
                cinetpay_response: cinetpayStatus
            }, { status: 400 })
        }

        // If payment is accepted, credit the user
        if (cinetpayStatus.status === 'ACCEPTED' && payment.status !== 'completed') {
            console.log('✅ Payment ACCEPTED by CinetPay, crediting user:', payment.user_id)

            // Calculate credits from plan or amount
            let creditsToAdd = payment.credits_purchased || 0

            if (!creditsToAdd) {
                // Try to get from metadata
                try {
                    const metadata = typeof payment.metadata === 'string'
                        ? JSON.parse(payment.metadata)
                        : payment.metadata
                    creditsToAdd = metadata?.credits || 0
                } catch (e) {
                    // Fallback: 1 credit per 10 FCFA
                    creditsToAdd = Math.floor(payment.amount_fcfa / 10)
                }
            }

            if (!creditsToAdd) {
                creditsToAdd = Math.floor(payment.amount_fcfa / 10)
            }

            console.log('💰 Credits to add:', creditsToAdd)

            // Get current user balance
            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_balance')
                .eq('id', payment.user_id)
                .single()

            const currentBalance = profile?.credits_balance || 0
            const newBalance = currentBalance + creditsToAdd

            // Update user credits
            const { error: creditError } = await supabase
                .from('profiles')
                .update({ credits_balance: newBalance })
                .eq('id', payment.user_id)

            if (creditError) {
                console.error('❌ Failed to update credits:', creditError)
                return Response.json({ error: 'Failed to update credits' }, { status: 500 })
            }

            // Update payment status
            await supabase
                .from('payments')
                .update({
                    status: 'completed',
                    credits_purchased: creditsToAdd,
                    completed_at: new Date().toISOString()
                })
                .eq('id', payment.id)

            // Update user plan if this is a subscription payment
            let planUpdated = false
            if (payment.payment_type === 'subscription') {
                // Get plan info from provider_response (metadata)
                const planData = payment.provider_response
                const planId = planData?.plan_id

                if (planId) {
                    // Map plan ID to plan name
                    let planName = 'free'
                    if (planId.includes('starter') || planData?.type === 'subscription' && creditsToAdd <= 1000) {
                        planName = 'starter'
                    } else if (planId.includes('pro') || creditsToAdd <= 3000) {
                        planName = 'pro'
                    } else if (planId.includes('business') || creditsToAdd >= 5000) {
                        planName = 'business'
                    }

                    // Update user's plan
                    await supabase
                        .from('profiles')
                        .update({ plan: planName })
                        .eq('id', payment.user_id)

                    console.log(`📋 Updated plan to: ${planName}`)
                    planUpdated = true
                }
            }

            console.log(`✅ SUCCESS! Added ${creditsToAdd} credits. Balance: ${currentBalance} → ${newBalance}`)

            return Response.json({
                success: true,
                message: 'Payment verified and credits added',
                credits_added: creditsToAdd,
                old_balance: currentBalance,
                new_balance: newBalance,
                plan_updated: planUpdated,
                cinetpay_status: cinetpayStatus.status
            })
        }

        // If payment is still pending or refused
        let newStatus = payment.status
        if (cinetpayStatus.status === 'REFUSED' || cinetpayStatus.status === 'CANCELLED') {
            newStatus = 'failed'
            await supabase
                .from('payments')
                .update({ status: newStatus })
                .eq('id', payment.id)
        }

        return Response.json({
            success: true,
            message: 'Payment status checked',
            current_status: newStatus,
            cinetpay_status: cinetpayStatus.status
        })

    } catch (error) {
        console.error('❌ Error:', error)
        return Response.json({ error: 'Internal error' }, { status: 500 })
    }
}

// GET - Check all pending payments
export async function GET(request: NextRequest) {
    try {
        // Get all pending/processing payments
        const { data: payments, error } = await supabase
            .from('payments')
            .select('id, user_id, amount_fcfa, status, provider_transaction_id, created_at')
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            return Response.json({ error: error.message }, { status: 500 })
        }

        return Response.json({
            pending_payments: payments,
            count: payments?.length || 0
        })
    } catch (error) {
        console.error('Error:', error)
        return Response.json({ error: 'Internal error' }, { status: 500 })
    }
}
