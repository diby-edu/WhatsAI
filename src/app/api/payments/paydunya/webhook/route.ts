import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { finalizePaymentByTransaction } from '@/lib/payments/finalization'
import {
    finalizeHostedCheckoutTransaction,
    isBookingTransactionId,
    isOrderTransactionId,
} from '@/lib/payments/hosted-checkout-finalization'
import {
    extractPayDunyaWebhookAmount,
    extractPayDunyaWebhookHash,
    extractPayDunyaWebhookInternalReference,
    extractPayDunyaWebhookReference,
    extractPayDunyaWebhookStatus,
    parsePayDunyaWebhookPayload,
    verifyPayDunyaWebhookHash,
    verifyPayDunyaTransaction,
} from '@/lib/payments/paydunya'

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function uniqueReferences(values: Array<string | null>) {
    const seen = new Set<string>()
    const output: string[] = []

    for (const value of values) {
        const normalized = String(value || '').trim()
        if (!normalized || seen.has(normalized)) continue
        seen.add(normalized)
        output.push(normalized)
    }

    return output
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text()
    const payload = parsePayDunyaWebhookPayload(rawBody, request.headers.get('content-type'))
    const receivedHash = extractPayDunyaWebhookHash(payload)

    if (!verifyPayDunyaWebhookHash(receivedHash)) {
        console.warn('[PayDunya Webhook] Invalid hash', {
            hasHash: Boolean(receivedHash),
            userAgent: request.headers.get('user-agent') || null,
            contentType: request.headers.get('content-type') || null,
        })
        return new Response('Invalid hash', { status: 401 })
    }

    try {
        const providerReference = extractPayDunyaWebhookReference(payload)
        const internalReference = extractPayDunyaWebhookInternalReference(payload)
        const references = uniqueReferences([internalReference, providerReference])

        if (references.length === 0) {
            console.warn('[PayDunya Webhook] Missing references for finalization')
            return new Response('OK', { status: 200 })
        }

        let providerStatus = extractPayDunyaWebhookStatus(payload)
        let providerPayload: unknown = payload
        let amount = extractPayDunyaWebhookAmount(payload)

        if (providerReference) {
            const verified = await verifyPayDunyaTransaction(providerReference)
            if (verified.success) {
                providerStatus = verified.status
                providerPayload = verified.raw || payload
                amount = verified.amount ?? amount
            }
        }

        const isTerminalStatus = (
            providerStatus === 'ACCEPTED'
            || providerStatus === 'REFUSED'
            || providerStatus === 'CANCELLED'
        )

        if (!isTerminalStatus) {
            console.info('[PayDunya Webhook] Non-final status ignored', {
                references,
                providerStatus,
            })
            return new Response('OK', { status: 200 })
        }

        if (providerStatus === 'ACCEPTED') {
            let hadHostedTransientFailure = false
            for (const reference of references) {
                const hostedFinalization = await finalizeHostedCheckoutTransaction(getSupabase(), reference, {
                    provider: 'paydunya',
                    amount: amount ?? null,
                    providerPayload,
                })

                if (hostedFinalization.ok) {
                    console.info('[PayDunya Webhook] Hosted checkout finalized', {
                        reference,
                        providerStatus,
                        state: hostedFinalization.state,
                    })
                    return new Response('OK', { status: 200 })
                }

                if (hostedFinalization.state !== 'not_found') {
                    // ok:false et state !== 'not_found' => échec réel de finalisation
                    // (pas juste "cette référence ne correspond à rien"). Forcer le retry.
                    hadHostedTransientFailure = true
                    console.error('[PayDunya Webhook] Hosted checkout finalization failed (will retry)', {
                        reference,
                        providerStatus,
                        state: hostedFinalization.state,
                    })
                }
            }

            if (hadHostedTransientFailure) {
                return new Response('Finalization failed, retry later', { status: 503 })
            }
        } else {
            for (const reference of references) {
                if (isOrderTransactionId(reference) || isBookingTransactionId(reference)) {
                    console.info('[PayDunya Webhook] Hosted checkout non-success terminal status received', {
                        reference,
                        providerStatus,
                    })
                    return new Response('OK', { status: 200 })
                }
            }
        }

        let hadTransientFailure = false
        for (const reference of references) {
            const finalized = await finalizePaymentByTransaction(
                getSupabase(),
                reference,
                providerStatus,
                providerPayload
            )

            if (!finalized.ok && finalized.state !== 'not_found') {
                // Échec transitoire : on renverra un 5xx après la boucle pour
                // forcer le retry provider (finalisation idempotente côté LM-2).
                hadTransientFailure = true
                console.error('[PayDunya Webhook] Account finalization failed (will retry)', {
                    reference,
                    providerStatus,
                    message: finalized.message,
                })
            } else if (finalized.state === 'not_found') {
                console.warn('[PayDunya Webhook] Account payment not found for finalization', {
                    reference,
                    providerStatus,
                })
            } else {
                console.info('[PayDunya Webhook] Account payment finalized', {
                    reference,
                    providerStatus,
                    state: finalized.state,
                })
                return new Response('OK', { status: 200 })
            }
        }

        if (hadTransientFailure) {
            return new Response('Finalization failed, retry later', { status: 503 })
        }

        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('[PayDunya Webhook] Unexpected error (will retry):', error)
        return new Response('Webhook error, retry later', { status: 500 })
    }
}

export async function GET() {
    return new Response('PayDunya webhook ready', { status: 200 })
}
