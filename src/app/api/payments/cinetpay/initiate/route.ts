import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// CinetPay API configuration
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID
const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2/payment'

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
        const { amount, customer_phone, customer_name, description, credits_to_add, test_mode } = body

        // Generate unique transaction ID
        const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(7)}`

        // Get app URL for callbacks
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        // Prepare CinetPay payload
        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: transactionId,
            transaction_id: transactionId,
            amount: amount < 100 ? Math.ceil(amount * 655) : amount, // Auto-convert low amounts (likely USD) to FCFA
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
                test_mode: test_mode
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
            await supabase.from('payments').insert({
                user_id: user.id,
                amount_fcfa: amount,
                credits_purchased: credits_to_add || Math.floor(amount / 10),
                payment_method: 'cinetpay',
                status: 'pending',
                transaction_id: transactionId,
                metadata: payload.metadata
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
