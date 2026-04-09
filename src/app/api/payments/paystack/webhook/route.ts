import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { finalizePaymentByTransaction } from '@/lib/payments/finalization'
import {
    finalizeHostedCheckoutTransaction,
    isBookingTransactionId,
    isOrderTransactionId,
} from '@/lib/payments/hosted-checkout-finalization'
import { verifyPaystackTransaction, verifyPaystackWebhookSignature } from '@/lib/payments/paystack'

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    const rawBody = await request.text()
    const signature = request.headers.get('x-paystack-signature') || ''

    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
        return new Response('Invalid signature', { status: 401 })
    }

    try {
        const body = JSON.parse(rawBody || '{}')
        if (body?.event !== 'charge.success') {
            return new Response('OK', { status: 200 })
        }

        const reference = String(body?.data?.reference || '').trim()
        if (!reference) {
            return new Response('OK', { status: 200 })
        }

        const verified = await verifyPaystackTransaction(reference)
        if (!verified.success || verified.status !== 'ACCEPTED') {
            return new Response('OK', { status: 200 })
        }

        if (isOrderTransactionId(reference)) {
            await finalizeHostedCheckoutTransaction(getSupabase(), reference, {
                provider: 'paystack',
                amount: verified.amount ?? null,
                providerPayload: verified.raw || verified,
            })
            return new Response('OK', { status: 200 })
        }

        if (isBookingTransactionId(reference)) {
            await finalizeHostedCheckoutTransaction(getSupabase(), reference, {
                provider: 'paystack',
                amount: verified.amount ?? null,
                providerPayload: verified.raw || verified,
            })
            return new Response('OK', { status: 200 })
        }

        const finalized = await finalizePaymentByTransaction(
            getSupabase(),
            reference,
            verified.status,
            {
                webhook: body,
                verification: verified.raw || verified,
            }
        )

        if (!finalized.ok && finalized.state !== 'not_found') {
            console.error('[Paystack Webhook] Finalization failed:', finalized.message)
        }

        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('[Paystack Webhook] Unexpected error:', error)
        return new Response('OK', { status: 200 })
    }
}

export async function GET() {
    return new Response('Paystack webhook ready', { status: 200 })
}
