import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { finalizePaymentByTransaction } from '@/lib/payments/finalization'
import {
    extractFeexPayWebhookCallbackInfo,
    extractFeexPayWebhookReference,
    extractFeexPayWebhookStatus,
    verifyFeexPayTransaction,
    verifyFeexPayWebhookSignature,
} from '@/lib/payments/feexpay'
import {
    finalizeHostedCheckoutTransaction,
    isBookingTransactionId,
    isOrderTransactionId,
} from '@/lib/payments/hosted-checkout-finalization'

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function resolveFinalizationReference(callbackInfo: string | null, providerReference: string | null) {
    const callback = String(callbackInfo || '').trim()
    const provider = String(providerReference || '').trim()

    // For hosted checkout flows, callback_info carries our internal ORD_/BKG_ reference.
    if (callback && (isOrderTransactionId(callback) || isBookingTransactionId(callback))) {
        return callback
    }

    // For account payments (credits/subscriptions), we finalize on provider_transaction_id.
    if (provider) {
        return provider
    }

    return callback || null
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text()
    const signatureResult = verifyFeexPayWebhookSignature(rawBody, request.headers)

    if (!signatureResult.ok) {
        console.warn('[FeexPay Webhook] Invalid signature', {
            mode: signatureResult.mode,
            userAgent: request.headers.get('user-agent') || null,
            hasAuthorizationHeader: Boolean(request.headers.get('authorization')),
        })
        return new Response('Invalid signature', { status: 401 })
    }

    try {
        const payload = JSON.parse(rawBody || '{}')
        const webhookReference = extractFeexPayWebhookReference(payload)
        const callbackInfo = extractFeexPayWebhookCallbackInfo(payload)
        const fallbackStatus = extractFeexPayWebhookStatus(payload)

        let providerStatus = fallbackStatus
        let providerPayload: unknown = payload

        if (webhookReference) {
            const verified = await verifyFeexPayTransaction(webhookReference)
            if (verified.success) {
                providerStatus = verified.status
                providerPayload = verified.raw || payload
            }
        }

        const isTerminalProviderStatus = (
            providerStatus === 'ACCEPTED'
            || providerStatus === 'REFUSED'
            || providerStatus === 'CANCELLED'
        )

        if (!isTerminalProviderStatus) {
            console.info('[FeexPay Webhook] Non-final status ignored', {
                reference: webhookReference,
                callbackInfo,
                providerStatus,
            })
            return new Response('OK', { status: 200 })
        }

        const finalizationReference = resolveFinalizationReference(callbackInfo, webhookReference)
        if (!finalizationReference) {
            console.warn('[FeexPay Webhook] Missing finalization reference', {
                reference: webhookReference,
                callbackInfo,
            })
            return new Response('OK', { status: 200 })
        }

        if (isOrderTransactionId(finalizationReference) || isBookingTransactionId(finalizationReference)) {
            if (providerStatus === 'ACCEPTED') {
                await finalizeHostedCheckoutTransaction(getSupabase(), finalizationReference, {
                    provider: 'feexpay',
                    amount: null,
                    providerPayload,
                })
                console.info('[FeexPay Webhook] Hosted checkout finalized', {
                    reference: webhookReference,
                    finalizationReference,
                    providerStatus,
                })
                return new Response('OK', { status: 200 })
            }

            console.info('[FeexPay Webhook] Hosted checkout terminal non-success status received', {
                reference: webhookReference,
                finalizationReference,
                providerStatus,
            })
            return new Response('OK', { status: 200 })
        }

        const finalized = await finalizePaymentByTransaction(
            getSupabase(),
            finalizationReference,
            providerStatus,
            providerPayload
        )

        if (finalized.state === 'not_found' && webhookReference && finalizationReference !== webhookReference) {
            // Safety retry: some historical rows were stored only with provider reference.
            const fallbackFinalized = await finalizePaymentByTransaction(
                getSupabase(),
                webhookReference,
                providerStatus,
                providerPayload
            )

            if (!fallbackFinalized.ok && fallbackFinalized.state !== 'not_found') {
                console.error('[FeexPay Webhook] Finalization fallback failed:', fallbackFinalized.message)
            } else {
                console.info('[FeexPay Webhook] Account payment finalized (fallback)', {
                    reference: webhookReference,
                    finalizationReference,
                    fallbackReference: webhookReference,
                    state: fallbackFinalized.state,
                })
            }

            return new Response('OK', { status: 200 })
        }

        if (!finalized.ok && finalized.state !== 'not_found') {
            console.error('[FeexPay Webhook] Finalization failed:', finalized.message)
        } else if (finalized.state === 'not_found') {
            console.warn('[FeexPay Webhook] Account payment not found for finalization', {
                reference: webhookReference,
                finalizationReference,
                callbackInfo,
            })
        } else {
            console.info('[FeexPay Webhook] Account payment finalized', {
                reference: webhookReference,
                finalizationReference,
                state: finalized.state,
            })
        }

        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('[FeexPay Webhook] Unexpected error:', error)
        return new Response('OK', { status: 200 })
    }
}

export async function GET() {
    return new Response('FeexPay webhook ready', { status: 200 })
}
