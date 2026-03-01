import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import {
    initializePayment,
    generateTransactionId,
    PaymentInitData
} from '@/lib/payments/cinetpay'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// POST /api/payments/initialize - Initialize a payment
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    // Rate limiting for payment endpoints (strict: 5 req/min)
    const identifier = getClientIdentifier(request, user!.id)
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.payment)

    if (!rateLimit.success) {
        return rateLimitResponse(rateLimit.resetTime)
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
            description = `Abonnement WazzapAI - ${plan.name}`
            metadata = {
                type: 'subscription',
                plan_id: planId,
                plan_name: plan.name,
                user_id: user!.id,
                credits: plan.credits_included,
            }
        } else if (type === 'credits') {
            // Credit pack purchase - fetch from database
            const adminSupabaseForPacks = createAdminClient()
            const { data: pack, error: packError } = await adminSupabaseForPacks
                .from('credit_packs')
                .select('*')
                .eq('id', packId)
                .eq('is_active', true)
                .single()

            if (packError || !pack) {
                // Fallback: try to find in defaults if database table doesn't exist (prices in FCFA)
                const defaultPacks = [
                    { id: 'boost_mini', credits: 200,   price: 3000 },
                    { id: 'boost_s',    credits: 500,   price: 7000 },
                    { id: 'boost_m',    credits: 2000,  price: 25000 },
                    { id: 'boost_l',    credits: 5000,  price: 55000 },
                    { id: 'boost_xl',   credits: 12000, price: 110000 },
                ]
                const fallbackPack = defaultPacks.find(p => p.id === packId)
                if (!fallbackPack) {
                    return errorResponse('Pack de crédits invalide', 400)
                }
                amount = fallbackPack.price
                description = `Pack de ${fallbackPack.credits} crédits WazzapAI`
                metadata = {
                    type: 'credits',
                    pack_id: packId,
                    user_id: user!.id,
                    credits: fallbackPack.credits,
                }
            } else {
                amount = pack.price
                description = `Pack de ${pack.credits} crédits WazzapAI`
                metadata = {
                    type: 'credits',
                    pack_id: packId,
                    user_id: user!.id,
                    credits: pack.credits,
                }
            }
        } else {
            return errorResponse('Type de paiement invalide', 400)
        }

        const transactionId = generateTransactionId()
        // Prices are stored in FCFA — use directly as XOF amount for CinetPay
        const amountFCFA = Math.ceil(amount)

        // Create payment record in database
        const adminSupabase = createAdminClient()
        const { data: payment, error: paymentError } = await adminSupabase
            .from('payments')
            .insert({
                user_id: user!.id,
                amount_fcfa: amountFCFA,
                payment_type: type,
                description,
                status: 'pending',
                payment_provider: 'cinetpay',
                provider_transaction_id: transactionId,
                customer_phone: profile.phone,
                customer_email: profile.email,
                credits_purchased: metadata.credits,
                provider_response: { ...metadata, amount_fcfa: amount },
            })
            .select('id')
            .single()

        if (paymentError) {
            console.error('Payment record error:', paymentError)
            return errorResponse('Erreur de création du paiement', 500)
        }

        // Initialize payment with CinetPay
        // Prices are stored in FCFA — send directly as XOF (no conversion needed)
        const paymentData: PaymentInitData = {
            amount: amountFCFA,
            currency: 'XOF',
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
                amount_fcfa: amount,
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
