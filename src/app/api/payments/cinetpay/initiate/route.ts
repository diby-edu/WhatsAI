import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// CinetPay API configuration
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID
const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2/payment'
const BASE_TO_XOF_RATE = 700

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
        return errorResponse('CinetPay non configuré', 500)
    }

    try {
        const body = await request.json()
        const { amount, customer_phone, customer_name, description, credits_to_add } = body

        // Generate unique transaction ID
        const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(7)}`
        const amountFCFA = amount < 100 ? Math.ceil(amount * BASE_TO_XOF_RATE) : amount

        // Get app URL for callbacks
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        // Prepare CinetPay payload
        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: transactionId,
            amount: amountFCFA, // Auto-convert low amounts (likely USD/EUR) to FCFA
            currency: 'XOF',
            description: description || 'Achat de crédits WazzapAI',
            notify_url: `${baseUrl}/api/payments/cinetpay/webhook`,
            return_url: `${baseUrl}/payment/success?transaction_id=${transactionId}`,
            cancel_url: `${baseUrl}/payment/success?payment=cancelled`,
            channels: 'ALL',
            customer_id: user.id,
            customer_name: customer_name || 'Client',
            customer_surname: '',
            customer_phone_number: customer_phone || '',
            metadata: JSON.stringify({
                user_id: user.id,
                credits_to_add: credits_to_add || Math.floor(amount / 10),
            })
        }

        // Call CinetPay API
        const response = await fetch(CINETPAY_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const result = await response.json()

        if (result.code === '201') {
            // Save pending payment to database
            // Note: provider_transaction_id is what webhook uses to find payments
            await supabase.from('payments').insert({
                user_id: user.id,
                amount_fcfa: amountFCFA,
                credits_purchased: credits_to_add || Math.floor(amount / 10),
                payment_provider: 'cinetpay',
                status: 'pending',
                provider_transaction_id: transactionId,
                payment_type: 'one_time'
            })

            return successResponse({
                transaction_id: transactionId,
                payment_url: result.data.payment_url,
                payment_token: result.data.payment_token
            })
        } else {
            return errorResponse(result.message || 'Erreur CinetPay', 400)
        }
    } catch (err: any) {
        console.error('CinetPay initiation error:', err)
        return errorResponse(err.message || 'Erreur lors de l\'initiation', 500)
    }
}
