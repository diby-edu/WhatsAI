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

export interface PaystackChannelInfo {
    paymentChannel: string | null
    paymentChannelDetail: string | null
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

function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePaystackChannel(value: unknown): string | null {
    const raw = String(value || '').trim()
    if (!raw) return null

    const normalized = raw
        .toLowerCase()
        .replace(/[^\w\s-]+/g, '')
        .replace(/[\s-]+/g, '_')

    if (normalized === 'mobilemoney') return 'mobile_money'
    if (normalized === 'banktransfer') return 'bank_transfer'
    if (normalized === 'qr_code') return 'qr'
    if (normalized === 'pay_with_bank' || normalized === 'bank_account') return 'bank'
    if (normalized === 'applepay') return 'apple_pay'
    if (normalized === 'directdebit') return 'direct_debit'

    return normalized || null
}

function cleanChannelDetail(value: unknown): string | null {
    const raw = String(value || '').trim()
    if (!raw) return null
    return raw
}

function normalizeComparableLabel(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]+/g, '')
        .replace(/[\s-]+/g, '_')
}

function pushCandidate(queue: unknown[], value: unknown) {
    if (value) {
        queue.push(value)
    }
}

function collectPaystackPayloadRecords(payload: unknown): Record<string, any>[] {
    const records: Record<string, any>[] = []
    const queue: unknown[] = [payload]
    const seen = new Set<Record<string, any>>()

    while (queue.length > 0) {
        const current = queue.shift()
        if (Array.isArray(current)) {
            current.forEach((entry) => pushCandidate(queue, entry))
            continue
        }
        if (!isRecord(current) || seen.has(current)) {
            continue
        }

        seen.add(current)
        records.push(current)

        pushCandidate(queue, current.data)
        pushCandidate(queue, current.raw)
        pushCandidate(queue, current.webhook)
        pushCandidate(queue, current.verification)
        pushCandidate(queue, current.last_verification_payload)
        pushCandidate(queue, current.authorization)
        pushCandidate(queue, current.mobile_money)
        pushCandidate(queue, current.metadata)
    }

    return records
}

function firstNonEmptyDetail(candidates: unknown[]) {
    for (const candidate of candidates) {
        const detail = cleanChannelDetail(candidate)
        if (detail) {
            return detail
        }
    }
    return null
}

function extractChannelDetail(records: Record<string, any>[], channel: string | null) {
    const candidates: unknown[] = []

    for (const record of records) {
        if (channel === 'mobile_money') {
            candidates.push(
                record.mobile_money?.provider,
                record.mobile_money?.network,
                record.authorization?.bank,
                record.authorization?.brand,
                record.channel_detail,
                record.channelDetail,
                record.metadata?.payment_channel_detail
            )
            continue
        }

        if (channel === 'card') {
            candidates.push(
                record.authorization?.brand,
                record.authorization?.card_type,
                record.authorization?.bank,
                record.channel_detail,
                record.channelDetail,
                record.metadata?.payment_channel_detail
            )
            continue
        }

        if (channel === 'bank' || channel === 'bank_transfer') {
            candidates.push(
                record.authorization?.bank,
                record.bank?.name,
                record.channel_detail,
                record.channelDetail,
                record.metadata?.payment_channel_detail
            )
            continue
        }

        candidates.push(
            record.channel_detail,
            record.channelDetail,
            record.mobile_money?.provider,
            record.mobile_money?.network,
            record.authorization?.brand,
            record.authorization?.bank,
            record.metadata?.payment_channel_detail
        )
    }

    return firstNonEmptyDetail(candidates)
}

export function extractPaystackChannelInfo(payload: unknown): PaystackChannelInfo {
    const records = collectPaystackPayloadRecords(payload)
    let paymentChannel: string | null = null

    for (const record of records) {
        paymentChannel = normalizePaystackChannel(record.channel || record.authorization?.channel)
        if (paymentChannel) {
            break
        }
    }

    let paymentChannelDetail = extractChannelDetail(records, paymentChannel)

    if (
        paymentChannel
        && paymentChannelDetail
        && normalizeComparableLabel(paymentChannelDetail) === normalizeComparableLabel(paymentChannel)
    ) {
        paymentChannelDetail = null
    }

    return {
        paymentChannel,
        paymentChannelDetail,
    }
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
