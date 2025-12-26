import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/api-utils'
import { checkPaymentStatus, verifyWebhookSignature } from '@/lib/payments/cinetpay'
import { PLANS, CREDIT_PACKS } from '@/lib/plans'

// POST /api/payments/webhook - CinetPay webhook handler
export async function POST(request: NextRequest) {
    try {
        const body = await request.text()
        const signature = request.headers.get('x-cinetpay-signature') || ''

        // Verify webhook signature
        if (!verifyWebhookSignature(body, signature)) {
            console.error('Invalid webhook signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const data = JSON.parse(body)
        const { cpm_trans_id: transactionId, cpm_result: result } = data

        console.log('CinetPay webhook received:', { transactionId, result })

        const supabase = createAdminClient()

        // Get payment from database
        const { data: payment, error } = await supabase
            .from('payments')
            .select('*, profiles(*)')
            .eq('provider_transaction_id', transactionId)
            .single()

        if (error || !payment) {
            console.error('Payment not found:', transactionId)
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
        }

        // Check payment status with CinetPay
        const statusCheck = await checkPaymentStatus(transactionId)

        if (statusCheck.status === 'ACCEPTED') {
            // Parse metadata
            const metadata = payment.provider_response?.metadata || {}

            if (metadata.type === 'subscription') {
                // Handle subscription payment
                const plan = PLANS[metadata.plan_id as keyof typeof PLANS]

                if (plan) {
                    // Calculate subscription period
                    const periodStart = new Date()
                    const periodEnd = new Date()
                    periodEnd.setMonth(periodEnd.getMonth() + 1)

                    // Create or update subscription
                    const { data: existingSub } = await supabase
                        .from('subscriptions')
                        .select('id')
                        .eq('user_id', payment.user_id)
                        .eq('status', 'active')
                        .single()

                    if (existingSub) {
                        // Update existing subscription
                        await supabase
                            .from('subscriptions')
                            .update({
                                plan: plan.id,
                                status: 'active',
                                credits_included: plan.credits,
                                price_fcfa: plan.price,
                                current_period_start: periodStart.toISOString(),
                                current_period_end: periodEnd.toISOString(),
                            })
                            .eq('id', existingSub.id)
                    } else {
                        // Create new subscription
                        await supabase
                            .from('subscriptions')
                            .insert({
                                user_id: payment.user_id,
                                plan: plan.id,
                                status: 'active',
                                credits_included: plan.credits,
                                price_fcfa: plan.price,
                                current_period_start: periodStart.toISOString(),
                                current_period_end: periodEnd.toISOString(),
                            })
                    }

                    // Update user profile with plan and credits
                    await supabase
                        .from('profiles')
                        .update({
                            plan: plan.id,
                            credits_balance: plan.credits,
                            credits_used_this_month: 0,
                        })
                        .eq('id', payment.user_id)
                }
            } else if (metadata.type === 'credits') {
                // Handle credit pack purchase
                const pack = CREDIT_PACKS.find(p => p.id === metadata.pack_id)

                if (pack) {
                    // Get current credits
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('credits_balance')
                        .eq('id', payment.user_id)
                        .single()

                    // Add credits
                    await supabase
                        .from('profiles')
                        .update({
                            credits_balance: (profile?.credits_balance || 0) + pack.credits,
                        })
                        .eq('id', payment.user_id)
                }
            }

            // Update payment as completed
            await supabase
                .from('payments')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    provider_response: data,
                })
                .eq('id', payment.id)

            console.log('Payment completed:', payment.id)
        } else if (statusCheck.status === 'REFUSED' || statusCheck.status === 'CANCELLED') {
            // Update payment as failed
            await supabase
                .from('payments')
                .update({
                    status: 'failed',
                    provider_response: data,
                })
                .eq('id', payment.id)

            console.log('Payment failed:', payment.id)
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Webhook error:', err)
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
    }
}
