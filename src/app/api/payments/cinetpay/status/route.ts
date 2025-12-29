import { NextRequest } from 'next/server'
import { createApiClient, successResponse, errorResponse } from '@/lib/api-utils'

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID

async function checkPaymentStatus(transactionId: string) {
    if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
        throw new Error('CinetPay non configuré')
    }

    const response = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: transactionId
        })
    })

    return response.json()
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transaction_id')

    if (!transactionId) {
        return errorResponse('transaction_id requis', 400)
    }

    try {
        const result = await checkPaymentStatus(transactionId)

        return successResponse({
            transaction_id: transactionId,
            status: result.data?.status || 'unknown',
            amount: result.data?.amount,
            currency: result.data?.currency,
            payment_method: result.data?.payment_method,
            raw: result
        })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur de vérification', 500)
    }
}

// POST method - also credits user on success
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const transactionId = body.transaction_id

        if (!transactionId) {
            return errorResponse('transaction_id requis', 400)
        }

        const result = await checkPaymentStatus(transactionId)
        const status = result.data?.status

        if (status === 'ACCEPTED') {
            // Check if already processed
            const supabase = await createApiClient()
            const { data: existingPayment } = await supabase
                .from('payments')
                .select('id, user_id, credits_purchased, status')
                .eq('transaction_id', transactionId)
                .single()

            if (existingPayment) {
                if (existingPayment.status === 'completed') {
                    // Already processed
                    return successResponse({
                        success: true,
                        status: 'ACCEPTED',
                        message: 'Paiement déjà traité',
                        credits_added: existingPayment.credits_purchased
                    })
                }

                // Update payment and add credits
                const creditsToAdd = existingPayment.credits_purchased || 0

                if (creditsToAdd > 0 && existingPayment.user_id) {
                    // Add credits to user
                    await supabase.rpc('add_credits', {
                        p_user_id: existingPayment.user_id,
                        p_credits: creditsToAdd
                    })

                    // Mark payment as completed
                    await supabase
                        .from('payments')
                        .update({ status: 'completed', completed_at: new Date().toISOString() })
                        .eq('id', existingPayment.id)
                }

                return successResponse({
                    success: true,
                    status: 'ACCEPTED',
                    message: 'Paiement confirmé',
                    credits_added: creditsToAdd
                })
            }
        }

        return successResponse({
            success: status === 'ACCEPTED',
            status: status || 'PENDING',
            transaction_id: transactionId,
            message: status === 'ACCEPTED' ? 'Paiement confirmé' : 'Paiement en attente',
            raw: result.data
        })
    } catch (err: any) {
        console.error('Payment status check error:', err)
        return errorResponse(err.message || 'Erreur de vérification', 500)
    }
}

