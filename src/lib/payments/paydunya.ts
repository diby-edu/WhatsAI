import crypto from 'crypto'

const PAYDUNYA_MASTER_KEY = String(process.env.PAYDUNYA_MASTER_KEY || '').trim()
const PAYDUNYA_PRIVATE_KEY = String(process.env.PAYDUNYA_PRIVATE_KEY || '').trim()
const PAYDUNYA_PUBLIC_KEY = String(process.env.PAYDUNYA_PUBLIC_KEY || '').trim()
const PAYDUNYA_TOKEN = String(process.env.PAYDUNYA_TOKEN || '').trim()
const PAYDUNYA_MODE = String(process.env.PAYDUNYA_MODE || 'live').trim().toLowerCase()
const PAYDUNYA_API_BASE_URL = String(process.env.PAYDUNYA_API_BASE_URL || '').trim()
const PAYDUNYA_STORE_NAME = String(process.env.PAYDUNYA_STORE_NAME || 'WazzapAI').trim()

type PayDunyaStatus = 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'

export interface PayDunyaInitInput {
    amountFcfa: number
    transactionId: string
    description: string
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    returnUrl: string
    failedUrl?: string
    notifyUrl: string
    metadata?: Record<string, any>
}

export interface PayDunyaInitResult {
    success: boolean
    token?: string | null
    paymentUrl?: string | null
    status?: string | null
    error?: string
    raw?: unknown
}

export interface PayDunyaStatusResult {
    success: boolean
    status: PayDunyaStatus
    transactionId: string
    amount?: number | null
    message?: string | null
    raw?: unknown
}

function toMode() {
    return PAYDUNYA_MODE === 'test' ? 'test' : 'live'
}

function resolvePayDunyaBaseUrl() {
    if (PAYDUNYA_API_BASE_URL) {
        return PAYDUNYA_API_BASE_URL.replace(/\/+$/, '')
    }
    return toMode() === 'test'
        ? 'https://app.paydunya.com/sandbox-api/v1'
        : 'https://app.paydunya.com/api/v1'
}

function sanitizeDescription(value: string) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
}

function normalizePhone(value?: string | null) {
    return String(value || '').replace(/\D+/g, '')
}

function normalizePayDunyaStatus(value: unknown): PayDunyaStatus {
    const normalized = String(value || '').trim().toLowerCase()
    if (normalized === 'completed' || normalized === 'success' || normalized === 'successful') return 'ACCEPTED'
    if (normalized === 'failed' || normalized === 'refused' || normalized === 'rejected') return 'REFUSED'
    if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'abandoned') return 'CANCELLED'
    if (normalized === 'pending' || normalized === 'processing') return 'PENDING'
    return 'UNKNOWN'
}

function normalizeHash(value: string) {
    return String(value || '').trim().toLowerCase()
}

function timingSafeHashEqual(a: string, b: string) {
    const left = Buffer.from(normalizeHash(a))
    const right = Buffer.from(normalizeHash(b))
    if (left.length !== right.length) return false

    try {
        return crypto.timingSafeEqual(left, right)
    } catch {
        return false
    }
}

function getPayDunyaExpectedHash() {
    if (!PAYDUNYA_MASTER_KEY) return ''
    return crypto
        .createHash('sha512')
        .update(PAYDUNYA_MASTER_KEY)
        .digest('hex')
}

function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstString(...values: unknown[]) {
    for (const value of values) {
        const candidate = String(value || '').trim()
        if (candidate) return candidate
    }
    return ''
}

function firstNumber(...values: unknown[]) {
    for (const value of values) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) {
            return parsed
        }
    }
    return null
}

function assignNested(target: Record<string, any>, rawKey: string, value: string) {
    const parts = String(rawKey || '')
        .split(/\[|\]/g)
        .map((part) => part.trim())
        .filter(Boolean)

    if (!parts.length) return

    let cursor: Record<string, any> = target
    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index]
        const isLeaf = index === parts.length - 1
        if (isLeaf) {
            cursor[part] = value
            return
        }

        if (!isRecord(cursor[part])) {
            cursor[part] = {}
        }
        cursor = cursor[part]
    }
}

function parseUrlEncodedPayload(rawBody: string) {
    const payload: Record<string, any> = {}
    const params = new URLSearchParams(rawBody)

    for (const [key, value] of params.entries()) {
        assignNested(payload, key, value)
    }

    if (typeof payload.data === 'string') {
        try {
            const parsedData = JSON.parse(payload.data)
            if (isRecord(parsedData)) {
                payload.data = parsedData
            }
        } catch {
            // Keep raw data string.
        }
    }

    return payload
}

export function isPayDunyaReady() {
    return Boolean(PAYDUNYA_MASTER_KEY && PAYDUNYA_PRIVATE_KEY && PAYDUNYA_TOKEN)
}

export function getPayDunyaMode() {
    return toMode()
}

export function verifyPayDunyaWebhookHash(receivedHash: unknown) {
    const expectedHash = getPayDunyaExpectedHash()
    const providedHash = String(receivedHash || '').trim()

    if (!expectedHash || !providedHash) {
        return false
    }

    return timingSafeHashEqual(expectedHash, providedHash)
}

export function parsePayDunyaWebhookPayload(rawBody: string, contentType?: string | null) {
    const normalizedContentType = String(contentType || '').toLowerCase()

    if (normalizedContentType.includes('application/json')) {
        try {
            const parsed = JSON.parse(rawBody || '{}')
            if (isRecord(parsed)) return parsed
        } catch {
            // Fallback to x-www-form-urlencoded.
        }
    }

    const formParsed = parseUrlEncodedPayload(rawBody || '')
    if (Object.keys(formParsed).length > 0) {
        return formParsed
    }

    try {
        const parsed = JSON.parse(rawBody || '{}')
        return isRecord(parsed) ? parsed : {}
    } catch {
        return {}
    }
}

export function extractPayDunyaWebhookData(payload: unknown) {
    if (!isRecord(payload)) return {}
    if (isRecord(payload.data)) return payload.data
    return payload
}

export function extractPayDunyaWebhookHash(payload: unknown) {
    const data = extractPayDunyaWebhookData(payload)
    const hash = firstString(
        data.hash,
        (payload as any)?.hash
    )
    return hash || null
}

export function extractPayDunyaWebhookReference(payload: unknown) {
    const data = extractPayDunyaWebhookData(payload)
    const invoice = isRecord(data.invoice) ? data.invoice : {}
    const reference = firstString(
        invoice.token,
        data.token,
        data.reference,
        data.transaction_id
    )
    return reference || null
}

export function extractPayDunyaWebhookInternalReference(payload: unknown) {
    const data = extractPayDunyaWebhookData(payload)
    const customData = isRecord(data.custom_data) ? data.custom_data : {}
    const internal = firstString(
        customData.transaction_id,
        customData.internal_transaction_id,
        customData.order_transaction_id,
        customData.booking_transaction_id
    )
    return internal || null
}

export function extractPayDunyaWebhookStatus(payload: unknown): PayDunyaStatus {
    const data = extractPayDunyaWebhookData(payload)
    const invoice = isRecord(data.invoice) ? data.invoice : {}

    return normalizePayDunyaStatus(
        firstString(
            data.status,
            invoice.status
        )
    )
}

export function extractPayDunyaWebhookAmount(payload: unknown) {
    const data = extractPayDunyaWebhookData(payload)
    const invoice = isRecord(data.invoice) ? data.invoice : {}
    return firstNumber(invoice.total_amount, data.amount)
}

function buildRequestHeaders() {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
        'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
        'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
    }

    // Some PayDunya accounts enforce the public key on HTTP/JSON endpoints.
    // Sending it when available remains backward-compatible.
    if (PAYDUNYA_PUBLIC_KEY) {
        headers['PAYDUNYA-PUBLIC-KEY'] = PAYDUNYA_PUBLIC_KEY
    }

    return headers
}

function normalizeChannels(metadata?: Record<string, any>) {
    const channels = metadata?.paydunya_channels
    if (!Array.isArray(channels)) return undefined

    const normalized = channels
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean)

    return normalized.length > 0 ? normalized : undefined
}

export async function initializePayDunyaPayment(input: PayDunyaInitInput): Promise<PayDunyaInitResult> {
    if (!isPayDunyaReady()) {
        return {
            success: false,
            error: 'PayDunya non configure',
        }
    }

    const amount = Math.max(0, Math.round(Number(input.amountFcfa || 0)))
    if (!Number.isFinite(amount) || amount <= 0) {
        return {
            success: false,
            error: 'Montant invalide pour PayDunya',
        }
    }

    const customerName = firstString(input.customerName) || 'Client'
    const customerEmail = firstString(input.customerEmail)
    const customerPhone = normalizePhone(input.customerPhone)
    const channels = normalizeChannels(input.metadata)

    const payload: Record<string, unknown> = {
        invoice: {
            total_amount: amount,
            description: sanitizeDescription(input.description || 'Paiement WazzapAI'),
            customer: {
                name: customerName,
                email: customerEmail || undefined,
                phone: customerPhone || undefined,
            },
            channels,
        },
        store: {
            name: PAYDUNYA_STORE_NAME || 'WazzapAI',
        },
        custom_data: {
            transaction_id: input.transactionId,
            internal_transaction_id: input.transactionId,
            ...(isRecord(input.metadata) ? input.metadata : {}),
        },
        actions: {
            cancel_url: input.failedUrl || input.returnUrl,
            return_url: input.returnUrl,
            callback_url: input.notifyUrl,
        },
    }

    try {
        const response = await fetch(`${resolvePayDunyaBaseUrl()}/checkout-invoice/create`, {
            method: 'POST',
            headers: buildRequestHeaders(),
            body: JSON.stringify(payload),
        })

        const raw = await response.json().catch(() => ({}))
        const responseCode = String((raw as any)?.response_code || '').trim()
        const token = firstString((raw as any)?.token)
        const paymentUrl = firstString((raw as any)?.response_text)
        const success = Boolean(response.ok && responseCode === '00' && (paymentUrl || token))

        if (!success) {
            return {
                success: false,
                error: firstString(
                    (raw as any)?.description,
                    (raw as any)?.response_text,
                    (raw as any)?.message
                ) || `PayDunya HTTP ${response.status}`,
                raw,
            }
        }

        return {
            success: true,
            token: token || null,
            paymentUrl: paymentUrl || null,
            status: 'PENDING',
            raw,
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erreur PayDunya',
        }
    }
}

export async function verifyPayDunyaTransaction(referenceToken: string): Promise<PayDunyaStatusResult> {
    if (!isPayDunyaReady()) {
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId: referenceToken,
            message: 'PayDunya non configure',
        }
    }

    const token = firstString(referenceToken)
    if (!token) {
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId: '',
            message: 'Reference PayDunya manquante',
        }
    }

    try {
        const response = await fetch(`${resolvePayDunyaBaseUrl()}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
            method: 'GET',
            headers: buildRequestHeaders(),
        })

        const raw = await response.json().catch(() => ({}))
        const invoice = isRecord((raw as any)?.invoice) ? (raw as any).invoice : {}
        const status = normalizePayDunyaStatus(firstString(invoice.status, (raw as any)?.status))
        const amount = firstNumber(invoice.total_amount, (raw as any)?.amount)
        const resolvedToken = firstString(invoice.token, (raw as any)?.token, token)
        const responseCode = String((raw as any)?.response_code || '').trim()

        return {
            success: Boolean(response.ok && (responseCode === '00' || status !== 'UNKNOWN')),
            status,
            transactionId: resolvedToken,
            amount,
            message: firstString(
                invoice.fail_reason,
                (raw as any)?.description,
                (raw as any)?.response_text
            ) || null,
            raw,
        }
    } catch (error) {
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId: token,
            message: error instanceof Error ? error.message : 'Erreur PayDunya',
        }
    }
}

export function getPayDunyaPublicKey() {
    return PAYDUNYA_PUBLIC_KEY || null
}
