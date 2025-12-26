import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-utils'

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transaction_id')

    if (!transactionId) {
        return errorResponse('transaction_id requis', 400)
    }

    if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
        return errorResponse('CinetPay non configuré', 500)
    }

    try {
        const response = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apikey: CINETPAY_API_KEY,
                site_id: CINETPAY_SITE_ID,
                transaction_id: transactionId
            })
        })

        const result = await response.json()

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
