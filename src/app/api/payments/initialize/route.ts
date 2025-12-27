import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import {
    initializePayment,
    generateTransactionId,
    PaymentInitData
} from '@/lib/payments/cinetpay'
import { CREDIT_PACKS } from '@/lib/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// POST /api/payments/initialize - Initialize a payment
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()
        const { type, planId, packId } = body

        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user!.id)
            .single()

        if (!profile) {
            return errorResponse('Profil non trouvé', 404)
        }

        let amount: number
        let description: string
        let metadata: Record<string, any>

        if (type === 'subscription') {
            // Fetch plan from database instead of constants
            const adminSupabase = createAdminClient()
            const { data: plan, error: planError } = await adminSupabase
                .from('subscription_plans')
                .select('*')
                .eq('id', planId)
                .eq('is_active', true)
                .single()

            if (planError || !plan) {
                console.error('Plan not found:', planId, planError)
                return errorResponse('Plan invalide ou non trouvé', 400)
            }

            if (plan.price_fcfa <= 0) {
                return errorResponse('Ce plan est gratuit', 400)
            }

            amount = plan.price_fcfa
            description = `Abonnement WhatsAI - ${plan.name}`
            metadata = {
                type: 'subscription',
                plan_id: planId,
                plan_name: plan.name,
                user_id: user!.id,
                credits: plan.credits_included,
            }
        } else if (type === 'credits') {
            // Credit pack purchase (still uses constants)
            const pack = CREDIT_PACKS.find(p => p.id === packId)
            if (!pack) {
                return errorResponse('Pack de crédits invalide', 400)
            }
            amount = pack.price
            description = `Pack de ${pack.credits} crédits WhatsAI`
            metadata = {
                type: 'credits',
                pack_id: packId,
                user_id: user!.id,
                credits: pack.credits,
            }
        } else {
            return errorResponse('Type de paiement invalide', 400)
        }

        const transactionId = generateTransactionId()

        // Create payment record in database
        const adminSupabase = createAdminClient()
        const { data: payment, error: paymentError } = await adminSupabase
            .from('payments')
            .insert({
                user_id: user!.id,
                amount_fcfa: amount,
                payment_type: type,
                description,
                status: 'pending',
                payment_provider: 'cinetpay',
                provider_transaction_id: transactionId,
                customer_phone: profile.phone,
                customer_email: profile.email,
            })
            .select('id')
            .single()

        if (paymentError) {
            console.error('Payment record error:', paymentError)
            return errorResponse('Erreur de création du paiement', 500)
        }

        // Initialize payment with CinetPay
        const paymentData: PaymentInitData = {
            amount,
            transactionId,
            description,
            customerName: profile.full_name || profile.email,
            customerEmail: profile.email,
            customerPhone: profile.phone || '',
            returnUrl: `${APP_URL}/dashboard/billing?payment=${payment.id}`,
            notifyUrl: `${APP_URL}/api/payments/cinetpay/webhook`,
            metadata: {
                ...metadata,
                payment_id: payment.id,
            },
        }

        const result = await initializePayment(paymentData)

        if (!result.success) {
            // Update payment as failed
            await adminSupabase
                .from('payments')
                .update({ status: 'failed' })
                .eq('id', payment.id)

            return errorResponse(result.error || 'Échec de l\'initialisation du paiement', 500)
        }

        // Update payment with token
        await adminSupabase
            .from('payments')
            .update({
                status: 'processing',
                provider_payment_url: result.paymentUrl,
            })
            .eq('id', payment.id)

        return successResponse({
            paymentId: payment.id,
            paymentUrl: result.paymentUrl,
            transactionId,
        })
    } catch (err) {
        console.error('Payment init error:', err)
        return errorResponse('Erreur de paiement', 500)
    }
}

// GET /api/payments/initialize - Get payment status
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
        return errorResponse('paymentId requis', 400)
    }

    const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .eq('user_id', user!.id)
        .single()

    if (error || !payment) {
        return errorResponse('Paiement non trouvé', 404)
    }

    return successResponse({ payment })
}
