import crypto from 'crypto'
import {
    getFeexPayNetworkOption,
    isFeexPayHostedRedirectNetwork,
    isFeexPayOtpNetwork,
    normalizeFeexPayCountry,
    normalizeFeexPayNetwork,
    resolveFeexPaySelection,
} from '@/lib/payments/feexpay-networks'

const FEEXPAY_API_KEY = String(process.env.FEEXPAY_API_KEY || '').trim()
const FEEXPAY_SHOP_ID = String(process.env.FEEXPAY_SHOP_ID || '').trim()
const FEEXPAY_API_BASE_URL = String(process.env.FEEXPAY_API_BASE_URL || 'https://api-v2.feexpay.me/api').replace(/\/+$/, '')
const FEEXPAY_STATUS_BASE_URL = String(process.env.FEEXPAY_STATUS_BASE_URL || 'https://api.feexpay.me/api').replace(/\/+$/, '')
const FEEXPAY_DEFAULT_NETWORK = String(process.env.FEEXPAY_DEFAULT_NETWORK || '').trim().toLowerCase()
const FEEXPAY_DEFAULT_OTP = String(process.env.FEEXPAY_DEFAULT_OTP || '').trim()
const FEEXPAY_WEBHOOK_SECRET = String(process.env.FEEXPAY_WEBHOOK_SECRET || '').trim()
const FEEXPAY_DEBUG_LOGS = String(process.env.FEEXPAY_DEBUG_LOGS || '').trim() === '1'

const FEEXPAY_SIGNATURE_HEADERS = [
    'x-feexpay-signature',
    'x-signature',
    'signature',
]

type FeexPayLogLevel = 'info' | 'warn' | 'error'

function logFeexPay(level: FeexPayLogLevel, event: string, payload: Record<string, unknown>) {
    const prefix = `[FeexPay][${event}]`

    if (level === 'info') {
        if (FEEXPAY_DEBUG_LOGS) {
            console.info(prefix, payload)
        }
        return
    }

    if (level === 'warn') {
        console.warn(prefix, payload)
        return
    }

    console.error(prefix, payload)
}

export interface FeexPayInitInput {
    amountFcfa: number
    transactionId: string
    description: string
    customerName?: string
    customerPhone?: string
    returnUrl: string
    failedUrl?: string
    metadata?: Record<string, any>
}

export interface FeexPayInitResult {
    success: boolean
    reference?: string | null
    paymentUrl?: string | null
    status?: string | null
    network?: string | null
    error?: string
    raw?: unknown
}

export interface FeexPayStatusResult {
    success: boolean
    status: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'
    transactionId: string
    amount?: number | null
    message?: string | null
    raw?: unknown
}

function splitCustomerName(name?: string | null) {
    const normalized = String(name || '').trim()
    if (!normalized) return { firstName: 'Client', lastName: 'WazzapAI' }

    const parts = normalized.split(/\s+/g).filter(Boolean)
    if (parts.length === 1) {
        return { firstName: parts[0].slice(0, 40), lastName: 'Client' }
    }

    return {
        firstName: parts[0].slice(0, 40),
        lastName: parts.slice(1).join(' ').slice(0, 60),
    }
}

function normalizeFeexPayPhone(phone?: string | null) {
    return String(phone || '').replace(/\D+/g, '')
}

function sanitizeFeexPayDescription(value: string) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[^\x20-\x7E]+/g, ' ')
        .replace(/[@#$%^*()_+=?\/\\`~\[\]{}|;:]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)
}

function isRecord(value: unknown): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toComparableSignature(value: string) {
    return String(value || '').trim().toLowerCase()
}

function timingSafeSignatureMatch(a: string, b: string) {
    const left = Buffer.from(toComparableSignature(a))
    const right = Buffer.from(toComparableSignature(b))
    if (left.length !== right.length) return false

    try {
        return crypto.timingSafeEqual(left, right)
    } catch {
        return false
    }
}

function normalizeFeexPayStatus(status: unknown): FeexPayStatusResult['status'] {
    const value = String(status || '').trim().toUpperCase()
    if (value === 'SUCCESS' || value === 'SUCCESSFUL' || value === 'ACCEPTED') return 'ACCEPTED'
    if (value === 'FAILED' || value === 'REFUSED') return 'REFUSED'
    if (value === 'CANCELLED') return 'CANCELLED'
    if (value === 'PENDING' || value === 'IN PENDING STATE' || value === 'INITIATED') return 'PENDING'
    return 'UNKNOWN'
}

function findDeepStringByKeys(input: unknown, keys: string[], maxDepth = 6): string {
    const targetKeys = new Set(keys.map((key) => String(key || '').trim().toLowerCase()).filter(Boolean))
    if (targetKeys.size === 0) return ''

    const queue: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }]
    const visited = new Set<unknown>()

    while (queue.length > 0) {
        const current = queue.shift()
        if (!current) continue
        const { value, depth } = current
        if (!value || visited.has(value)) continue
        visited.add(value)

        if (depth > maxDepth) continue

        if (Array.isArray(value)) {
            for (const item of value) {
                queue.push({ value: item, depth: depth + 1 })
            }
            continue
        }

        if (!isRecord(value)) continue

        for (const [rawKey, rawValue] of Object.entries(value)) {
            const key = String(rawKey || '').trim().toLowerCase()
            if (targetKeys.has(key)) {
                const candidate = String(rawValue || '').trim()
                if (candidate) return candidate
            }

            if (Array.isArray(rawValue) || isRecord(rawValue)) {
                queue.push({ value: rawValue, depth: depth + 1 })
            }
        }
    }

    return ''
}

function extractFeexPayReference(raw: unknown) {
    return findDeepStringByKeys(raw, [
        'reference',
        'transref',
        'transaction_id',
        'id_transaction',
        'order_id',
    ])
}

function extractFeexPayPaymentUrl(raw: unknown) {
    return findDeepStringByKeys(raw, [
        'payment_url',
        'redirect_url',
        'url',
        'checkout_url',
    ])
}

function extractFeexPayStatusText(raw: unknown) {
    return findDeepStringByKeys(raw, [
        'status',
        'message',
        'responsemsg',
        'responsedesc',
    ])
}

function extractFeexPayReasonText(raw: unknown) {
    return findDeepStringByKeys(raw, [
        'reason',
        'comment',
        'responsedesc',
        'response_operator',
        'error',
    ])
}

function extractFeexPayResponseCode(raw: unknown) {
    return findDeepStringByKeys(raw, [
        'responsecode',
        'statuscode',
        'status_code',
        'code',
    ])
}

function normalizeFeexPayStatusFromPayload(raw: unknown): FeexPayStatusResult['status'] {
    const statusText = extractFeexPayStatusText(raw)
    const normalized = normalizeFeexPayStatus(statusText)
    if (normalized !== 'UNKNOWN') return normalized

    const code = String(extractFeexPayResponseCode(raw) || '').trim().toUpperCase()
    if (code === 'FAILED' || code === 'REFUSED') return 'REFUSED'
    if (code === 'CANCELLED') return 'CANCELLED'
    if (code === 'SUCCESS' || code === 'SUCCESSFUL' || code === 'ACCEPTED') return 'ACCEPTED'
    if (code === 'PENDING' || code === 'INITIATED') return 'PENDING'

    return 'UNKNOWN'
}

function resolveNetwork(metadata?: Record<string, any>) {
    const requestedCountry = normalizeFeexPayCountry(metadata?.feexpay_country || metadata?.country)
    const requestedNetwork = normalizeFeexPayNetwork(metadata?.feexpay_network || metadata?.network)
    const selection = resolveFeexPaySelection({
        country: requestedCountry,
        network: requestedNetwork,
        phone: String(metadata?.customer_phone || '').trim(),
        defaultNetwork: FEEXPAY_DEFAULT_NETWORK,
    })
    return selection.networkCode || ''
}

export function isFeexPayReady() {
    return Boolean(FEEXPAY_API_KEY && FEEXPAY_SHOP_ID)
}

export function getFeexPayDefaultNetwork() {
    return FEEXPAY_DEFAULT_NETWORK
}

export function networkRequiresOtp(network: string) {
    return isFeexPayOtpNetwork(network)
}

export function networkSupportsHostedUrl(network: string) {
    return isFeexPayHostedRedirectNetwork(network)
}

function resolveOtp(network: string, metadata?: Record<string, any>) {
    if (!networkRequiresOtp(network)) return ''
    return String(metadata?.feexpay_otp || FEEXPAY_DEFAULT_OTP || '').trim()
}

export async function initializeFeexPayPayment(input: FeexPayInitInput): Promise<FeexPayInitResult> {
    if (!isFeexPayReady()) {
        logFeexPay('warn', 'INIT_MISSING_CONFIG', {
            hasApiKey: Boolean(FEEXPAY_API_KEY),
            hasShopId: Boolean(FEEXPAY_SHOP_ID),
        })
        return {
            success: false,
            error: 'FeexPay non configure',
        }
    }

    const network = resolveNetwork({
        ...(input.metadata || {}),
        customer_phone: input.customerPhone || '',
    })
    if (!network) {
        logFeexPay('warn', 'INIT_MISSING_NETWORK', {
            transactionId: input.transactionId,
        })
        return {
            success: false,
            error: 'Reseau FeexPay manquant (feexpay_network/feexpay_country) et FEEXPAY_DEFAULT_NETWORK absent',
        }
    }

    const phoneNumber = normalizeFeexPayPhone(input.customerPhone)
    if (!phoneNumber) {
        logFeexPay('warn', 'INIT_MISSING_PHONE', {
            transactionId: input.transactionId,
            network,
        })
        return {
            success: false,
            error: 'Numero client requis pour FeexPay',
        }
    }

    const amount = Math.max(0, Math.round(Number(input.amountFcfa || 0)))
    if (!Number.isFinite(amount) || amount <= 0) {
        logFeexPay('warn', 'INIT_INVALID_AMOUNT', {
            transactionId: input.transactionId,
            network,
            amount: input.amountFcfa,
        })
        return {
            success: false,
            error: 'Montant invalide pour FeexPay',
        }
    }

    const { firstName, lastName } = splitCustomerName(input.customerName)
    const description = sanitizeFeexPayDescription(input.description || 'Paiement WazzapAI')
    const networkOption = getFeexPayNetworkOption(network)
    const otp = resolveOtp(network, input.metadata)

    if (networkRequiresOtp(network) && !otp) {
        logFeexPay('warn', 'INIT_MISSING_OTP', {
            transactionId: input.transactionId,
            network,
        })
        return {
            success: false,
            error: `Le reseau ${network} requiert un OTP (FEEXPAY_DEFAULT_OTP ou metadata.feexpay_otp)`,
        }
    }

    const payload: Record<string, unknown> = {
        shop: FEEXPAY_SHOP_ID,
        amount,
        phoneNumber,
        firstName,
        lastName,
        first_name: firstName,
        last_name: lastName,
        description,
        callback_info: input.transactionId,
    }

    // Hosted redirect networks can safely use return/cancel URLs.
    if (networkSupportsHostedUrl(network)) {
        payload.return_url = input.returnUrl
        payload.cancel_url = input.failedUrl || input.returnUrl
    }

    if (otp) {
        payload.otp = otp
    }

    async function fetchHostedUrlFromStatus(reference: string) {
        const normalizedRef = String(reference || '').trim()
        if (!normalizedRef) return ''

        const candidateUrls = [
            `${FEEXPAY_STATUS_BASE_URL}/transactions/public/single/status/${encodeURIComponent(normalizedRef)}`,
            `${FEEXPAY_API_BASE_URL}/transactions/public/single/status/${encodeURIComponent(normalizedRef)}`,
        ]

        for (const candidateUrl of candidateUrls) {
            try {
                logFeexPay('info', 'STATUS_LOOKUP_ATTEMPT', {
                    transactionId: input.transactionId,
                    reference: normalizedRef,
                    candidateUrl,
                })
                const response = await fetch(candidateUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${FEEXPAY_API_KEY}`,
                    },
                })

                const raw = await response.json().catch(() => ({}))
                if (!response.ok) continue

                const paymentUrl = extractFeexPayPaymentUrl(raw)
                if (paymentUrl) {
                    logFeexPay('info', 'STATUS_LOOKUP_PAYMENT_URL_FOUND', {
                        transactionId: input.transactionId,
                        reference: normalizedRef,
                    })
                    return paymentUrl
                }
            } catch {
                // ignore and continue with the next status endpoint
            }
        }

        return ''
    }

    try {
        logFeexPay('info', 'INIT_ATTEMPT', {
            transactionId: input.transactionId,
            network,
            country: networkOption?.countryCode || null,
            amount,
            hasReturnUrl: Boolean(input.returnUrl),
        })
        const response = await fetch(`${FEEXPAY_API_BASE_URL}/transactions/public/requesttopay/${encodeURIComponent(network)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FEEXPAY_API_KEY}`,
            },
            body: JSON.stringify(payload),
        })

        const raw = await response.json().catch(() => ({}))
        const data = isRecord(raw) ? raw : {}
        const reference = extractFeexPayReference(data)
        let paymentUrl = extractFeexPayPaymentUrl(data)
        const statusText = extractFeexPayStatusText(data) || null
        const status = normalizeFeexPayStatusFromPayload(data)
        const reasonText = extractFeexPayReasonText(data)

        const acceptedHttp = response.ok
        const hasUsefulResponse = Boolean(reference || paymentUrl || statusText)

        if (!acceptedHttp || !hasUsefulResponse) {
            logFeexPay('warn', 'INIT_REJECTED', {
                transactionId: input.transactionId,
                network,
                statusCode: response.status,
                providerMessage: String(data.message || data.error || '').trim() || null,
            })
            return {
                success: false,
                network,
                error: String(data.message || data.error || `FeexPay HTTP ${response.status}`),
                raw,
            }
        }

        if (status === 'REFUSED' || status === 'CANCELLED') {
            const providerError = String(reasonText || data.message || data.error || '').trim()
            logFeexPay('warn', 'INIT_TERMINAL_NON_SUCCESS', {
                transactionId: input.transactionId,
                network,
                status,
                providerError: providerError || null,
            })
            return {
                success: false,
                network,
                status: statusText,
                error: providerError || `Paiement ${status === 'REFUSED' ? 'refuse' : 'annule'} par FeexPay`,
                raw,
            }
        }

        if (!paymentUrl && reference && networkSupportsHostedUrl(network)) {
            paymentUrl = await fetchHostedUrlFromStatus(reference)
            if (!paymentUrl) {
                logFeexPay('warn', 'INIT_PAYMENT_URL_MISSING_AFTER_STATUS_LOOKUP', {
                    transactionId: input.transactionId,
                    network,
                    reference,
                })
            }
        }

        logFeexPay('info', 'INIT_ACCEPTED', {
            transactionId: input.transactionId,
            network,
            reference: reference || null,
            hasPaymentUrl: Boolean(paymentUrl),
            providerStatus: status || null,
        })
        return {
            success: true,
            network,
            reference: reference || null,
            paymentUrl: paymentUrl || null,
            status: statusText,
            raw,
        }
    } catch (error) {
        logFeexPay('error', 'INIT_EXCEPTION', {
            transactionId: input.transactionId,
            network,
            error: error instanceof Error ? error.message : 'Erreur FeexPay',
        })
        return {
            success: false,
            network,
            error: error instanceof Error ? error.message : 'Erreur FeexPay',
        }
    }
}

function extractStatusPayload(raw: unknown): Record<string, any> {
    if (!isRecord(raw)) return {}
    if (isRecord(raw.data)) return raw.data
    return raw
}

export async function verifyFeexPayTransaction(reference: string): Promise<FeexPayStatusResult> {
    if (!isFeexPayReady()) {
        logFeexPay('warn', 'VERIFY_MISSING_CONFIG', {
            reference,
            hasApiKey: Boolean(FEEXPAY_API_KEY),
            hasShopId: Boolean(FEEXPAY_SHOP_ID),
        })
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId: reference,
            message: 'FeexPay non configure',
        }
    }

    const normalizedRef = String(reference || '').trim()
    if (!normalizedRef) {
        logFeexPay('warn', 'VERIFY_MISSING_REFERENCE', {})
        return {
            success: false,
            status: 'UNKNOWN',
            transactionId: '',
            message: 'Reference FeexPay manquante',
        }
    }

    const candidateUrls = [
        `${FEEXPAY_STATUS_BASE_URL}/transactions/public/single/status/${encodeURIComponent(normalizedRef)}`,
        `${FEEXPAY_API_BASE_URL}/transactions/public/single/status/${encodeURIComponent(normalizedRef)}`,
    ]

    let lastMessage = 'Verification FeexPay impossible'
    let lastRaw: unknown = null

    for (const candidateUrl of candidateUrls) {
        try {
            logFeexPay('info', 'VERIFY_ATTEMPT', {
                reference: normalizedRef,
                candidateUrl,
            })
            const response = await fetch(candidateUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${FEEXPAY_API_KEY}`,
                },
            })

            const raw = await response.json().catch(() => ({}))
            const payload = extractStatusPayload(raw)
            const statusFromPayload = normalizeFeexPayStatusFromPayload(payload)
            const status = statusFromPayload !== 'UNKNOWN'
                ? statusFromPayload
                : normalizeFeexPayStatusFromPayload(raw)
            const statusText = extractFeexPayStatusText(payload) || extractFeexPayStatusText(raw)
            const reasonText = extractFeexPayReasonText(payload) || extractFeexPayReasonText(raw)
            const providerMessage = String(statusText || reasonText || '').trim()
            const amountValue = Number(payload.amount ?? payload.total ?? payload.montant)
            const providerTx = String(
                payload.reference
                || payload.transaction_id
                || payload.id_transaction
                || normalizedRef
            ).trim()

            if (response.ok) {
                logFeexPay('info', 'VERIFY_SUCCESS', {
                    reference: normalizedRef,
                    providerStatus: status,
                    providerTransactionId: providerTx || normalizedRef,
                })
                return {
                    success: true,
                    status,
                    transactionId: providerTx || normalizedRef,
                    amount: Number.isFinite(amountValue) ? amountValue : null,
                    message: providerMessage || null,
                    raw,
                }
            }

            lastMessage = String(providerMessage || payload.error || `FeexPay HTTP ${response.status}`)
            lastRaw = raw
        } catch (error) {
            lastMessage = error instanceof Error ? error.message : 'Erreur FeexPay'
        }
    }

    logFeexPay('warn', 'VERIFY_FAILED', {
        reference: normalizedRef,
        message: lastMessage,
    })
    return {
        success: false,
        status: 'UNKNOWN',
        transactionId: normalizedRef,
        message: lastMessage,
        raw: lastRaw,
    }
}

export function extractFeexPayWebhookReference(payload: unknown) {
    if (!isRecord(payload)) return null
    const candidate = String(
        payload.reference
        || payload.id_transaction
        || payload.transaction_id
        || payload?.data?.reference
        || ''
    ).trim()
    return candidate || null
}

export function extractFeexPayWebhookStatus(payload: unknown) {
    if (!isRecord(payload)) return 'UNKNOWN'
    return normalizeFeexPayStatus(payload.status || payload?.data?.status || '')
}

export function extractFeexPayWebhookCallbackInfo(payload: unknown) {
    if (!isRecord(payload)) return null
    const callbackInfo = String(
        payload.callback_info
        || payload.callbackInfo
        || payload?.data?.callback_info
        || ''
    ).trim()
    return callbackInfo || null
}

export function verifyFeexPayWebhookSignature(rawBody: string, headers: Headers) {
    if (!FEEXPAY_WEBHOOK_SECRET) {
        // Fail-closed : sans secret configuré, aucun webhook n'est accepté
        // (aligné sur CinetPay/Paystack). La finalisation des paiements reste
        // possible via la route de statut client + réconciliation cron.
        return { ok: false, mode: 'missing-secret' as const }
    }

    let signature = ''
    for (const headerName of FEEXPAY_SIGNATURE_HEADERS) {
        const value = String(headers.get(headerName) || '').trim()
        if (value) {
            signature = value
            break
        }
    }

    if (!signature) {
        return { ok: false, mode: 'missing' as const }
    }

    const expectedSha256Hex = crypto.createHmac('sha256', FEEXPAY_WEBHOOK_SECRET).update(rawBody).digest('hex')
    const expectedSha256Base64 = crypto.createHmac('sha256', FEEXPAY_WEBHOOK_SECRET).update(rawBody).digest('base64')
    const expectedSha512Hex = crypto.createHmac('sha512', FEEXPAY_WEBHOOK_SECRET).update(rawBody).digest('hex')

    const isValid = (
        timingSafeSignatureMatch(signature, expectedSha256Hex)
        || timingSafeSignatureMatch(signature, expectedSha256Base64)
        || timingSafeSignatureMatch(signature, expectedSha512Hex)
    )

    return { ok: isValid, mode: 'strict' as const }
}
