import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupportedPlatformProvider } from '@/lib/api/platform-webhook-normalizer'

type VerificationResult = {
    valid: boolean
    mode: 'provider_hmac' | 'wazzap_hmac' | 'token_only'
    reason?: string
}

function safeTimingEqual(left: Buffer, right: Buffer): boolean {
    if (left.length !== right.length) return false
    try {
        return timingSafeEqual(left, right)
    } catch {
        return false
    }
}

function verifyShopifySignature(rawBody: string, signature: string, secret: string): boolean {
    const expectedBase64 = createHmac('sha256', secret).update(rawBody).digest('base64')
    return safeTimingEqual(Buffer.from(signature), Buffer.from(expectedBase64))
}

function verifyWooSignature(rawBody: string, signature: string, secret: string): boolean {
    const expectedBase64 = createHmac('sha256', secret).update(rawBody).digest('base64')
    return safeTimingEqual(Buffer.from(signature), Buffer.from(expectedBase64))
}

function verifyWazzapSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
    const cleaned = signatureHeader.trim()
    const providedHex = cleaned.startsWith('sha256=') ? cleaned.slice(7) : cleaned
    const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex')

    try {
        return safeTimingEqual(
            Buffer.from(providedHex, 'hex'),
            Buffer.from(expectedHex, 'hex')
        )
    } catch {
        return false
    }
}

export function verifyIncomingWebhookSignature(params: {
    provider: SupportedPlatformProvider
    headers: Headers
    rawBody: string
    signingSecret: string
}): VerificationResult {
    const { provider, headers, rawBody, signingSecret } = params

    if (!signingSecret) {
        return { valid: false, mode: 'token_only', reason: 'Missing signing secret on connection' }
    }

    if (provider === 'shopify') {
        const signature = headers.get('x-shopify-hmac-sha256')?.trim()
        if (!signature) {
            return { valid: false, mode: 'provider_hmac', reason: 'Missing X-Shopify-Hmac-SHA256 header' }
        }
        const valid = verifyShopifySignature(rawBody, signature, signingSecret)
        return { valid, mode: 'provider_hmac', reason: valid ? undefined : 'Invalid Shopify signature' }
    }

    if (provider === 'woocommerce') {
        const signature = headers.get('x-wc-webhook-signature')?.trim()
        if (!signature) {
            return { valid: false, mode: 'provider_hmac', reason: 'Missing X-WC-Webhook-Signature header' }
        }
        const valid = verifyWooSignature(rawBody, signature, signingSecret)
        return { valid, mode: 'provider_hmac', reason: valid ? undefined : 'Invalid WooCommerce signature' }
    }

    const fallbackSignature = headers.get('x-wazzap-signature')?.trim()
    if (!fallbackSignature) {
        return {
            valid: true,
            mode: 'token_only',
        }
    }

    const valid = verifyWazzapSignature(rawBody, fallbackSignature, signingSecret)
    return { valid, mode: 'wazzap_hmac', reason: valid ? undefined : 'Invalid X-Wazzap-Signature' }
}
