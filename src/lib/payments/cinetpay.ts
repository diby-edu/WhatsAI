import crypto from 'crypto'

// CinetPay Configuration
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID || ''
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY || ''
const CINETPAY_SECRET_KEY = process.env.CINETPAY_SECRET_KEY || ''
const CINETPAY_MODE = process.env.CINETPAY_MODE || 'sandbox'

const BASE_URL = CINETPAY_MODE === 'live'
    ? 'https://api-checkout.cinetpay.com/v2'
    : 'https://api-checkout.cinetpay.com/v2'

export interface PaymentInitData {
    amount: number
    currency?: string
    transactionId: string
    description: string
    customerName: string
    customerEmail: string
    customerPhone: string
    returnUrl: string
    notifyUrl: string
    metadata?: Record<string, any>
}

export interface PaymentInitResponse {
    success: boolean
    paymentUrl?: string
    paymentToken?: string
    error?: string
}

export interface PaymentStatus {
    success: boolean
    status: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'
    transactionId: string
    amount?: number
    message?: string
}

/**
 * Initialize a payment with CinetPay
 */
export async function initializePayment(
    data: PaymentInitData
): Promise<PaymentInitResponse> {
    try {
        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: data.transactionId,
            amount: data.amount,
            currency: data.currency || 'XOF',
            description: data.description,
            customer_name: data.customerName,
            customer_email: data.customerEmail,
            customer_phone_number: data.customerPhone,
            return_url: data.returnUrl,
            notify_url: data.notifyUrl,
            channels: 'ALL',
            metadata: JSON.stringify(data.metadata || {}),
            lang: 'fr',
        }

        const response = await fetch(`${BASE_URL}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (result.code === '201') {
            return {
                success: true,
                paymentUrl: result.data.payment_url,
                paymentToken: result.data.payment_token,
            }
        } else {
            return {
                success: false,
                error: result.message || 'Payment initialization failed',
            }
        }
    } catch (error) {
        console.error('CinetPay init error:', error)
        return {
            success: false,
            error: (error as Error).message,
        }
    }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(
    transactionId: string
): Promise<PaymentStatus> {
    try {
        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: transactionId,
        }

        const response = await fetch(`${BASE_URL}/payment/check`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (result.code === '00') {
            const status = result.data.status

            let paymentStatus: PaymentStatus['status']
            switch (status) {
                case 'ACCEPTED':
                    paymentStatus = 'ACCEPTED'
                    break
                case 'REFUSED':
                    paymentStatus = 'REFUSED'
                    break
                case 'CANCELLED':
                    paymentStatus = 'CANCELLED'
                    break
                default:
                    paymentStatus = 'PENDING'
            }

            return {
                success: true,
                status: paymentStatus,
                transactionId,
                amount: result.data.amount,
                message: result.data.payment_method,
            }
        } else {
            return {
                success: false,
                status: 'UNKNOWN',
                transactionId,
                message: result.message,
            }
        }
    } catch (error) {
        console.error('CinetPay status check error:', error)
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId,
            message: (error as Error).message,
        }
    }
}

/**
 * Verify webhook signature (Timing-Safe)
 */
export function verifyWebhookSignature(
    payload: string,
    signature: string
): boolean {
    if (!CINETPAY_SECRET_KEY) {
        console.error('CINETPAY_SECRET_KEY missing - rejecting webhook for security')
        return false // REJECT unsigned webhooks
    }

    const expectedSignature = crypto
        .createHmac('sha256', CINETPAY_SECRET_KEY)
        .update(payload)
        .digest('hex')

    // ⭐ SECURITY FIX: Use timing-safe comparison to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
        return false
    }

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        )
    } catch {
        return false
    }
}

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId(prefix: string = 'WAZZAPAI'): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${prefix}_${timestamp}_${random}`.toUpperCase()
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number, currency: string = 'XOF'): string {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

export interface PaymentStatusV2Runtime {
    status: string
    amount: number | null
    message: string | null
    providerTransactionId: string | null
}

let cinetPayV2AccessTokenCache: string | null = null
let cinetPayV2TokenExpiresAt = 0
let cinetPayV2Ipv4Dispatcher: any = null

function truncateCinetPayV2DebugValue(value: unknown, maxLength = 240) {
    const text = String(value ?? '')
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength)}...`
}

function getCinetPayV2BaseUrl() {
    return String(process.env.CINETPAY_V2_BASE_URL || 'https://api.cinetpay.net')
        .trim()
        .replace(/\/+$/, '')
}

function getCinetPayV2AccountKey() {
    return String(process.env.CINETPAY_V2_ACCOUNT_KEY || '').trim()
}

function getCinetPayV2AccountPassword() {
    return String(process.env.CINETPAY_V2_ACCOUNT_PASSWORD || '').trim()
}

function isCinetPayV2Configured() {
    const enabled = ['1', 'true', 'yes', 'on'].includes(
        String(process.env.CINETPAY_V2_ENABLED || '').trim().toLowerCase()
    )

    return Boolean(
        enabled
        && getCinetPayV2BaseUrl()
        && getCinetPayV2AccountKey()
        && getCinetPayV2AccountPassword()
    )
}

function getCinetPayV2FetchOptions() {
    try {
        if (!cinetPayV2Ipv4Dispatcher) {
            const { TextDecoder, TextEncoder } = require('node:util')
            const { ReadableStream, WritableStream, TransformStream } = require('node:stream/web')
            if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder
            if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder
            if (typeof global.ReadableStream === 'undefined') global.ReadableStream = ReadableStream
            if (typeof global.WritableStream === 'undefined') global.WritableStream = WritableStream
            if (typeof global.TransformStream === 'undefined') global.TransformStream = TransformStream

            const { Agent: UndiciAgent } = require('undici')
            cinetPayV2Ipv4Dispatcher = new UndiciAgent({
                connect: {
                    family: 4
                }
            })
        }

        return {
            dispatcher: cinetPayV2Ipv4Dispatcher
        }
    } catch (_error) {
        return {}
    }
}

async function readCinetPayV2ResponseBody(response: any) {
    if (typeof response?.text === 'function') {
        const rawText = await response.text().catch(() => '')
        try {
            return {
                payload: rawText ? JSON.parse(rawText) : {},
                rawText
            }
        } catch (_error) {
            return {
                payload: {},
                rawText
            }
        }
    }

    return {
        payload: await response?.json?.().catch(() => ({})) || {},
        rawText: null
    }
}

function summarizeCinetPayV2Response(response: any, payload: any, rawText: string | null) {
    return {
        http_status: Number.isFinite(Number(response?.status)) ? Number(response.status) : null,
        ok: typeof response?.ok === 'boolean' ? response.ok : null,
        code: payload?.code ?? null,
        status: payload?.status ?? null,
        message: payload?.message ?? null,
        description: payload?.description ?? null,
        details: payload?.details ?? null,
        raw_text: rawText ? truncateCinetPayV2DebugValue(rawText, 320) : null
    }
}

function extractStatusFromCinetPayV2Payload(payload: any) {
    const topLevelStatus = String(payload?.status || '').trim()
    const nestedStatus = String(payload?.details?.status || '').trim()

    if (topLevelStatus.toUpperCase() === 'OK' && nestedStatus) {
        return nestedStatus
    }

    return topLevelStatus || nestedStatus || 'UNKNOWN'
}

async function getCinetPayV2AccessToken() {
    if (cinetPayV2AccessTokenCache && cinetPayV2TokenExpiresAt > Date.now()) {
        return cinetPayV2AccessTokenCache
    }

    const loginRequestPayload = {
        api_key: getCinetPayV2AccountKey(),
        api_password: getCinetPayV2AccountPassword()
    }

    const response = await fetch(`${getCinetPayV2BaseUrl()}/v1/oauth/login`, {
        method: 'POST',
        ...getCinetPayV2FetchOptions(),
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify(loginRequestPayload)
    } as any)

    const { payload, rawText } = await readCinetPayV2ResponseBody(response)

    if (!response.ok || payload?.status !== 'OK' || !payload?.access_token) {
        console.error('CinetPay v2 status login failed:', {
            endpoint: `${getCinetPayV2BaseUrl()}/v1/oauth/login`,
            request: {
                api_key_prefix: loginRequestPayload.api_key ? `${loginRequestPayload.api_key.slice(0, 8)}...` : null,
                api_key_length: loginRequestPayload.api_key.length,
                api_password_length: loginRequestPayload.api_password.length
            },
            response: summarizeCinetPayV2Response(response, payload, rawText)
        })
        throw new Error(payload?.description || payload?.message || 'Echec de connexion a CinetPay v2')
    }

    const expiresIn = Number(payload?.expires_in || 0)
    cinetPayV2AccessTokenCache = payload.access_token
    cinetPayV2TokenExpiresAt = Date.now() + Math.max(0, expiresIn - 60) * 1000
    return cinetPayV2AccessTokenCache
}

export async function checkPaymentStatusV2Runtime(identifier: string): Promise<PaymentStatusV2Runtime> {
    if (!isCinetPayV2Configured()) {
        return {
            status: 'UNKNOWN',
            amount: null,
            message: 'CinetPay v2 non configure',
            providerTransactionId: null
        }
    }

    const normalizedIdentifier = String(identifier || '').trim()
    if (!normalizedIdentifier) {
        return {
            status: 'UNKNOWN',
            amount: null,
            message: 'Identifiant de transaction manquant',
            providerTransactionId: null
        }
    }

    try {
        const accessToken = await getCinetPayV2AccessToken()
        const endpoint = `${getCinetPayV2BaseUrl()}/v1/payment/${encodeURIComponent(normalizedIdentifier)}`
        const response = await fetch(endpoint, {
            method: 'GET',
            ...getCinetPayV2FetchOptions(),
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`
            }
        } as any)

        const { payload, rawText } = await readCinetPayV2ResponseBody(response)
        const resolvedStatus = extractStatusFromCinetPayV2Payload(payload)

        if (!response.ok) {
            console.error('CinetPay v2 status check failed:', {
                identifier: normalizedIdentifier,
                endpoint,
                response: summarizeCinetPayV2Response(response, payload, rawText)
            })
        }

        return {
            status: resolvedStatus,
            amount: Number(payload?.amount || payload?.data?.amount || 0) || null,
            message: payload?.description
                || payload?.message
                || payload?.details?.message
                || truncateCinetPayV2DebugValue(rawText || '', 320)
                || null,
            providerTransactionId: String(
                payload?.transaction_id
                || payload?.data?.transaction_id
                || ''
            ).trim() || null
        }
    } catch (error: any) {
        console.error('CinetPay v2 status check threw:', {
            identifier: normalizedIdentifier,
            error: error?.message || 'Erreur de verification CinetPay v2'
        })

        return {
            status: 'UNKNOWN',
            amount: null,
            message: error?.message || 'Erreur de verification CinetPay v2',
            providerTransactionId: null
        }
    }
}
