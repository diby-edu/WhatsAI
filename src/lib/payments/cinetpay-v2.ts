const CINETPAY_V2_BASE_URL = (process.env.CINETPAY_V2_BASE_URL || 'https://api.cinetpay.net').replace(/\/+$/, '')
const CINETPAY_V2_ACCOUNT_KEY = process.env.CINETPAY_V2_ACCOUNT_KEY || ''
const CINETPAY_V2_ACCOUNT_PASSWORD = process.env.CINETPAY_V2_ACCOUNT_PASSWORD || ''
const CINETPAY_V2_FALLBACK_EMAIL_DOMAIN = process.env.CINETPAY_V2_FALLBACK_EMAIL_DOMAIN || 'wazzapai.com'

type UnifiedPaymentStatus = 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'

export interface CinetPayV2InitData {
    amount: number
    currency?: 'XOF' | 'XAF' | 'GNF' | 'CDF'
    merchantTransactionId: string
    designation: string
    clientFullName?: string | null
    clientEmail?: string | null
    clientPhoneNumber?: string | null
    successUrl: string
    failedUrl: string
    notifyUrl: string
    paymentMethod?: string | null
    directPay?: boolean
    otpCode?: string | null
}

export interface CinetPayV2InitResponse {
    success: boolean
    paymentUrl?: string
    paymentToken?: string
    notifyToken?: string
    providerTransactionId?: string
    status?: string
    mustBeRedirected?: boolean
    message?: string
    error?: string
    raw?: any
}

export interface CinetPayV2StatusResponse {
    success: boolean
    status: UnifiedPaymentStatus
    rawStatus?: string
    merchantTransactionId?: string
    providerTransactionId?: string
    message?: string
    amount?: number
    user?: {
        name?: string
        email?: string
        phone_number?: string
    }
    raw?: any
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null

function parseAllowedAgentIds() {
    return String(process.env.CINETPAY_V2_TEST_AGENT_IDS || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
}

export function getCinetPayV2AllowedAgentIds(): string[] {
    return parseAllowedAgentIds()
}

export function isCinetPayV2Enabled(): boolean {
    return process.env.CINETPAY_V2_ENABLED === 'true'
}

export function isCinetPayV2Configured(): boolean {
    return Boolean(
        isCinetPayV2Enabled() &&
        CINETPAY_V2_BASE_URL &&
        CINETPAY_V2_ACCOUNT_KEY &&
        CINETPAY_V2_ACCOUNT_PASSWORD &&
        parseAllowedAgentIds().length > 0
    )
}

export function shouldUseCinetPayV2ForAgent(agentId?: string | null): boolean {
    if (!agentId || !isCinetPayV2Configured()) {
        return false
    }

    return parseAllowedAgentIds().includes(agentId)
}

function normalizePhoneDigits(phone?: string | null) {
    return String(phone || '').replace(/\D/g, '')
}

export function splitCustomerName(fullName?: string | null) {
    const normalized = String(fullName || '').trim().replace(/\s+/g, ' ')
    if (!normalized) {
        return { firstName: 'Client', lastName: 'Wazzapai' }
    }

    const parts = normalized.split(' ')
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: 'Client' }
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
    }
}

export function buildFallbackCustomerEmail(email?: string | null, phone?: string | null) {
    const normalizedEmail = String(email || '').trim()
    if (normalizedEmail) {
        return normalizedEmail
    }

    const digits = normalizePhoneDigits(phone)
    if (digits) {
        return `wa-${digits}@${CINETPAY_V2_FALLBACK_EMAIL_DOMAIN}`
    }

    return `client@${CINETPAY_V2_FALLBACK_EMAIL_DOMAIN}`
}

async function loginCinetPayV2() {
    const response = await fetch(`${CINETPAY_V2_BASE_URL}/v1/oauth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
        },
        body: JSON.stringify({
            api_key: CINETPAY_V2_ACCOUNT_KEY,
            api_password: CINETPAY_V2_ACCOUNT_PASSWORD
        })
    })

    const result = await response.json()
    if (!response.ok || Number(result?.code) !== 200 || !result?.access_token) {
        throw new Error(result?.description || result?.message || 'CinetPay v2 OAuth login failed')
    }

    const expiresIn = Number(result.expires_in || 3600)
    cachedAccessToken = {
        value: result.access_token,
        expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000
    }

    return cachedAccessToken.value
}

async function getCinetPayV2AccessToken(forceRefresh = false) {
    if (!forceRefresh && cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
        return cachedAccessToken.value
    }

    return loginCinetPayV2()
}

async function authenticatedRequest(path: string, init: RequestInit = {}, retry = true) {
    const accessToken = await getCinetPayV2AccessToken()
    const response = await fetch(`${CINETPAY_V2_BASE_URL}${path}`, {
        ...init,
        headers: {
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${accessToken}`,
            ...(init.headers || {})
        }
    })

    const result = await response.json().catch(() => null)
    const code = Number(result?.code)
    if (retry && (response.status === 401 || code === 1002 || code === 1003)) {
        cachedAccessToken = null
        return authenticatedRequest(path, init, false)
    }

    return { response, result }
}

function mapV2Status(rawStatus?: string | null): UnifiedPaymentStatus {
    switch (String(rawStatus || '').toUpperCase()) {
        case 'SUCCESS':
            return 'ACCEPTED'
        case 'FAILED':
        case 'INSUFFICIENT_BALANCE':
            return 'REFUSED'
        case 'EXPIRED':
            return 'CANCELLED'
        case 'INITIATED':
        case 'PENDING':
            return 'PENDING'
        default:
            return 'UNKNOWN'
    }
}

export async function initializePaymentV2(data: CinetPayV2InitData): Promise<CinetPayV2InitResponse> {
    try {
        const { firstName, lastName } = splitCustomerName(data.clientFullName)
        const clientEmail = buildFallbackCustomerEmail(data.clientEmail, data.clientPhoneNumber)

        const payload: Record<string, unknown> = {
            currency: data.currency || 'XOF',
            merchant_transaction_id: data.merchantTransactionId,
            amount: data.amount,
            lang: 'fr',
            designation: data.designation,
            client_email: clientEmail,
            client_phone_number: data.clientPhoneNumber || undefined,
            client_first_name: firstName,
            client_last_name: lastName,
            direct_pay: data.directPay === true,
            success_url: data.successUrl,
            failed_url: data.failedUrl,
            notify_url: data.notifyUrl,
        }

        if (data.paymentMethod) {
            payload.payment_method = data.paymentMethod
        }

        if (data.otpCode) {
            payload.otp_code = data.otpCode
        }

        const { response, result } = await authenticatedRequest('/v1/payment', {
            method: 'POST',
            body: JSON.stringify(payload)
        })

        if (!response.ok || Number(result?.code) !== 200 || String(result?.status || '').toUpperCase() !== 'OK') {
            return {
                success: false,
                error: result?.description || result?.message || 'CinetPay v2 payment initialization failed',
                raw: result
            }
        }

        return {
            success: true,
            paymentUrl: result.payment_url,
            paymentToken: result.payment_token,
            notifyToken: result.notify_token,
            providerTransactionId: result.transaction_id,
            status: result.details?.status,
            mustBeRedirected: Boolean(result.details?.must_be_redirected),
            message: result.details?.message,
            raw: result
        }
    } catch (error) {
        console.error('CinetPay v2 init error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'CinetPay v2 payment initialization failed'
        }
    }
}

export async function checkPaymentStatusV2(identifier: string): Promise<CinetPayV2StatusResponse> {
    try {
        const { response, result } = await authenticatedRequest(`/v1/payment/${encodeURIComponent(identifier)}`, {
            method: 'GET'
        })

        const rawStatus = String(result?.status || '').toUpperCase()
        if (!response.ok || !rawStatus) {
            return {
                success: false,
                status: 'UNKNOWN',
                rawStatus,
                message: result?.description || result?.message || 'CinetPay v2 payment status failed',
                raw: result
            }
        }

        return {
            success: true,
            status: mapV2Status(rawStatus),
            rawStatus,
            merchantTransactionId: result?.merchant_transaction_id,
            providerTransactionId: result?.transaction_id,
            user: result?.user,
            raw: result
        }
    } catch (error) {
        console.error('CinetPay v2 status check error:', error)
        return {
            success: false,
            status: 'UNKNOWN',
            message: error instanceof Error ? error.message : 'CinetPay v2 payment status failed'
        }
    }
}

export function isCinetPayV2WebhookPayload(payload: unknown): payload is {
    notify_token: string
    merchant_transaction_id: string
    transaction_id?: string
    user?: {
        name?: string
        email?: string
        phone_number?: string
    }
} {
    if (!payload || typeof payload !== 'object') {
        return false
    }

    const candidate = payload as Record<string, unknown>
    return typeof candidate.notify_token === 'string'
        && typeof candidate.merchant_transaction_id === 'string'
}
