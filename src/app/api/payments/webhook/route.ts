import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/api-utils'
import { checkPaymentStatus, verifyWebhookSignature } from '@/lib/payments/cinetpay'
import { finalizePaymentByTransaction } from '@/lib/payments/finalization'

// Legacy webhook endpoint kept for compatibility.
// Finalization is delegated to the shared payment finalizer.
export async function POST(request: NextRequest) {
    try {
        const body = await request.text()
        const signature = request.headers.get('x-cinetpay-signature') || ''

        if (!verifyWebhookSignature(body, signature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        const payload = JSON.parse(body)
        const transactionId = String(payload?.cpm_trans_id || '').trim()

        if (!transactionId) {
            return NextResponse.json({ error: 'Missing transaction id' }, { status: 400 })
        }

        const providerStatus = await checkPaymentStatus(transactionId)
        if (!providerStatus.success) {
            return NextResponse.json({ error: 'Provider status check failed' }, { status: 400 })
        }

        const adminSupabase = createAdminClient()
        const finalized = await finalizePaymentByTransaction(
            adminSupabase,
            transactionId,
            providerStatus.status,
            payload
        )

        if (finalized.state === 'not_found') {
            return NextResponse.json({ error: finalized.message }, { status: 404 })
        }

        if (!finalized.ok) {
            return NextResponse.json({ error: finalized.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            state: finalized.state,
            provider_status: finalized.providerStatus,
        })
    } catch (err) {
        console.error('Webhook error:', err)
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
    }
}
