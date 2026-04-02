import crypto from 'crypto'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || ''
const PAYSTACK_BASE_URL = 'https://api.paystack.co'

export interface PaystackInitData {
    amountFcfa: number
    currency?: string
    reference: string
    description: string
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    callbackUrl: string
    metadata?: Record<string, any>
}

export interface PaystackInitResponse {
    success: boolean
    paymentUrl?: string
    accessCode?: string
    reference?: string
    error?: string
    raw?: unknown
}

export interface PaystackStatus {
    success: boolean
    status: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'
    transactionId: string
    amount?: number | null
    message?: string | null
    raw?: unknown
}

function buildFallbackEmail(reference: string, phone?: string | null) {
    const normalizedPhone = String(phone || '')
        .replace(/\D+/g, '')
        .slice(-12)

    const localPart = normalizedPhone || reference.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return `${localPart}@pay.wazzapai.local`
}

export function resolvePaystackCustomerEmail(
    customerEmail?: string | null,
    reference?: string | null,
    customerPhone?: string | null
) {
    const normalized = String(customerEmail || '').trim()
    if (normalized) return normalized
    return buildFallbackEmail(String(reference || 'transaction'), customerPhone)
}

export function toPaystackSubunitAmount(amountFcfa: number) {
    return Math.max(0, Math.round(Number(amountFcfa || 0) * 100))
}

function normalizePaystackStatus(status: unknown): PaystackStatus['status'] {
    const value = String(status || '').trim().toLowerCase()

    if (value === 'success') return 'ACCEPTED'
    if (value === 'failed') return 'REFUSED'
    if (value === 'abandoned' || value === 'cancelled') return 'CANCELLED'
    if (value === 'ongoing' || value === 'pending' || value === 'processing' || value === 'queued') {
        return 'PENDING'
    }

    return 'UNKNOWN'
}

export async function initializePaystackPayment(data: PaystackInitData): Promise<PaystackInitResponse> {
    if (!PAYSTACK_SECRET_KEY) {
        return {
            success: false,
            error: 'Paystack non configure',
        }
    }

    try {
        const payload = {
            email: resolvePaystackCustomerEmail(data.customerEmail, data.reference, data.customerPhone),
            amount: toPaystackSubunitAmount(data.amountFcfa),
            currency: data.currency || 'XOF',
            reference: data.reference,
            callback_url: data.callbackUrl,
            metadata: {
                description: data.description,
                customer_name: data.customerName || 'Client',
                customer_phone: data.customerPhone || '',
                ...(data.metadata || {})
            }
        }

        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
            },
            body: JSON.stringify(payload)
        })

        const result = await response.json().catch(() => ({}))
        const gatewayData = result?.data || {}

        if (response.ok && result?.status === true && gatewayData.authorization_url) {
            return {
                success: true,
                paymentUrl: gatewayData.authorization_url,
                accessCode: gatewayData.access_code || null,
                reference: gatewayData.reference || data.reference,
                raw: result
            }
        }

        return {
            success: false,
            error: result?.message || 'Initialisation Paystack impossible',
            raw: result
        }
    } catch (error) {
        console.error('Paystack init error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erreur Paystack'
        }
    }
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackStatus> {
    if (!PAYSTACK_SECRET_KEY) {
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId: reference,
            message: 'Paystack non configure'
        }
    }

    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
            }
        })

        const result = await response.json().catch(() => ({}))
        const payment = result?.data || {}
        const normalizedStatus = normalizePaystackStatus(payment?.status)

        return {
            success: response.ok && result?.status === true,
            status: normalizedStatus,
            transactionId: reference,
            amount: Number.isFinite(Number(payment?.amount))
                ? Number(payment.amount) / 100
                : null,
            message: payment?.gateway_response || result?.message || null,
            raw: result
        }
    } catch (error) {
        console.error('Paystack verify error:', error)
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId: reference,
            message: error instanceof Error ? error.message : 'Erreur Paystack'
        }
    }
}

export function verifyPaystackWebhookSignature(payload: string, signature: string) {
    if (!PAYSTACK_SECRET_KEY || !signature) {
        return false
    }

    const expectedSignature = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY)
        .update(payload)
        .digest('hex')

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
