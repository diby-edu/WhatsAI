const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID
const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2/payment'
let cinetPayV2AccessTokenCache = null
let cinetPayV2TokenExpiresAt = 0
let cinetPayV2Ipv4Dispatcher = null

function truncateCinetPayV2DebugValue(value, maxLength = 180) {
    const text = String(value ?? '')
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength)}...`
}

function maskCinetPayV2PhoneNumber(phoneNumber) {
    const text = String(phoneNumber || '').trim()
    if (!text) return null
    if (text.length <= 6) return text
    return `${text.slice(0, 4)}***${text.slice(-3)}`
}

function summarizeCinetPayV2Payload(payload) {
    return {
        currency: payload?.currency || null,
        amount: payload?.amount ?? null,
        merchant_transaction_id: payload?.merchant_transaction_id || null,
        merchant_transaction_id_length: String(payload?.merchant_transaction_id || '').length,
        designation: truncateCinetPayV2DebugValue(payload?.designation || ''),
        designation_length: String(payload?.designation || '').length,
        client_email: payload?.client_email || null,
        client_phone_number_masked: maskCinetPayV2PhoneNumber(payload?.client_phone_number),
        client_first_name: payload?.client_first_name || null,
        client_last_name: payload?.client_last_name || null,
        payment_method: payload?.payment_method || null,
        direct_pay: payload?.direct_pay ?? null,
        success_url: truncateCinetPayV2DebugValue(payload?.success_url || ''),
        success_url_length: String(payload?.success_url || '').length,
        failed_url: truncateCinetPayV2DebugValue(payload?.failed_url || ''),
        failed_url_length: String(payload?.failed_url || '').length,
        notify_url: truncateCinetPayV2DebugValue(payload?.notify_url || ''),
        notify_url_length: String(payload?.notify_url || '').length
    }
}

function summarizeCinetPayV2Response(response, payload, rawText) {
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

async function readCinetPayV2ResponseBody(response) {
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

function getCinetPayV2FallbackEmailDomain() {
    return String(process.env.CINETPAY_V2_FALLBACK_EMAIL_DOMAIN || 'wazzapai.com')
        .trim()
        .replace(/^@+/, '')
}

function getCinetPayV2TestAgentIds() {
    return String(process.env.CINETPAY_V2_TEST_AGENT_IDS || '')
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
}

function isCinetPayV2Enabled() {
    const value = String(process.env.CINETPAY_V2_ENABLED || '').trim().toLowerCase()
    return ['1', 'true', 'yes', 'on'].includes(value)
}

function isCinetPayV2Configured() {
    return Boolean(
        isCinetPayV2Enabled()
        && getCinetPayV2BaseUrl()
        && getCinetPayV2AccountKey()
        && getCinetPayV2AccountPassword()
    )
}

function shouldUseCinetPayV2ForAgent(agentId) {
    if (!isCinetPayV2Configured()) return false
    return getCinetPayV2TestAgentIds().includes(String(agentId || '').trim())
}

function splitCinetPayV2CustomerName(fullName) {
    const normalized = String(fullName || '').trim().replace(/\s+/g, ' ')
    if (!normalized) {
        return { firstName: 'Client', lastName: 'Wazzapai' }
    }

    const parts = normalized.split(' ')
    const firstName = String(parts.shift() || 'Client').trim() || 'Client'
    const lastName = String(parts.join(' ') || 'Client').trim() || 'Client'

    return {
        firstName: firstName.slice(0, 255),
        lastName: lastName.slice(0, 255)
    }
}

function buildCinetPayV2ClientEmail(clientPhoneNumber) {
    const digits = String(clientPhoneNumber || '').replace(/\D/g, '')
    const domain = getCinetPayV2FallbackEmailDomain()
    return `wa-${digits || Date.now()}@${domain}`
}

function inferCinetPayV2PaymentMethod(clientPhoneNumber) {
    const digits = String(clientPhoneNumber || '').replace(/\D/g, '')

    if (digits.startsWith('22507')) return 'OM'
    if (digits.startsWith('22505')) return 'MTN'
    if (digits.startsWith('22501')) return 'MOOV'

    return null
}

function inferCinetPayV2PaymentMethodCandidates(clientPhoneNumber) {
    const digits = String(clientPhoneNumber || '').replace(/\D/g, '')
    const candidates = []

    if (digits.startsWith('22507')) {
        candidates.push('OM', 'OM_CI', null)
    } else if (digits.startsWith('22505')) {
        candidates.push('MTN', 'MTN_CI', null)
    } else if (digits.startsWith('22501')) {
        candidates.push('MOOV', 'MOOV_CI', null)
    } else {
        candidates.push(inferCinetPayV2PaymentMethod(clientPhoneNumber), null)
    }

    const unique = []
    for (const candidate of candidates) {
        if (!unique.some(value => value === candidate)) {
            unique.push(candidate)
        }
    }

    return unique
}

function buildCinetPayV2SafeSlug(value, fallback = 'tx') {
    const normalized = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    return (normalized || fallback).slice(0, 20)
}

function buildCinetPayV2MerchantTransactionId(baseTransactionId, attemptIndex) {
    if (attemptIndex <= 1) return baseTransactionId

    const suffix = `-r${attemptIndex}`
    const maxBaseLength = Math.max(0, 30 - suffix.length)
    return `${String(baseTransactionId || '').slice(0, maxBaseLength)}${suffix}`
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
    })

    const { payload, rawText } = await readCinetPayV2ResponseBody(response)
    if (!response.ok || payload?.status !== 'OK' || !payload?.access_token) {
        console.error('CinetPay v2 login failed:', {
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

async function initializePaymentV2({
    amount,
    currency,
    merchantTransactionId,
    designation,
    clientFullName,
    clientPhoneNumber,
    paymentMethod,
    successUrl,
    failedUrl,
    notifyUrl
}) {
    if (!isCinetPayV2Configured()) {
        return { success: false, error: 'CinetPay v2 non configure' }
    }

    try {
        const accessToken = await getCinetPayV2AccessToken()
        const { firstName, lastName } = splitCinetPayV2CustomerName(clientFullName)
        const resolvedPaymentMethod = paymentMethod === undefined
            ? inferCinetPayV2PaymentMethod(clientPhoneNumber)
            : paymentMethod
        const requestPayload = {
            currency: String(currency || 'XOF').trim(),
            amount: Number(amount || 0),
            merchant_transaction_id: String(merchantTransactionId || '').trim().slice(0, 30),
            lang: 'fr',
            designation: String(designation || 'Paiement CinetPay').trim(),
            client_email: buildCinetPayV2ClientEmail(clientPhoneNumber),
            client_phone_number: String(clientPhoneNumber || '').trim() || undefined,
            client_first_name: firstName,
            client_last_name: lastName,
            payment_method: resolvedPaymentMethod || undefined,
            direct_pay: false,
            success_url: String(successUrl || '').trim().slice(0, 120),
            failed_url: String(failedUrl || '').trim().slice(0, 120),
            notify_url: String(notifyUrl || '').trim().slice(0, 120)
        }
        const response = await fetch(`${getCinetPayV2BaseUrl()}/v1/payment`, {
            method: 'POST',
            ...getCinetPayV2FetchOptions(),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            body: JSON.stringify(requestPayload)
        })

        const { payload, rawText } = await readCinetPayV2ResponseBody(response)
        if (!response.ok || payload?.status !== 'OK' || !payload?.payment_url) {
            const errorSummary = [
                payload?.description,
                payload?.message,
                payload?.details?.message,
                payload?.status,
                payload?.code ? `code=${payload.code}` : null,
            ]
                .filter(Boolean)
                .join(' | ')
                || 'Erreur CinetPay v2'
            console.error('CinetPay v2 payment init failed:', {
                request: summarizeCinetPayV2Payload(requestPayload),
                response: summarizeCinetPayV2Response(response, payload, rawText)
            })
            return {
                success: false,
                error: errorSummary
            }
        }

        return {
            success: true,
            paymentUrl: payload.payment_url,
            providerTransactionId: payload.transaction_id || null,
            notifyToken: payload.notify_token || null,
            paymentToken: payload.payment_token || null
        }
    } catch (error) {
        console.error('CinetPay v2 payment init threw:', {
            merchant_transaction_id: String(merchantTransactionId || '').trim().slice(0, 30),
            client_phone_number_masked: maskCinetPayV2PhoneNumber(clientPhoneNumber),
            error: error?.message || 'Erreur CinetPay v2'
        })
        return {
            success: false,
            error: error?.message || 'Erreur CinetPay v2'
        }
    }
}


module.exports = {
    CINETPAY_API_KEY,
    CINETPAY_SITE_ID,
    CINETPAY_BASE_URL,
    shouldUseCinetPayV2ForAgent,
    inferCinetPayV2PaymentMethodCandidates,
    buildCinetPayV2SafeSlug,
    buildCinetPayV2MerchantTransactionId,
    initializePaymentV2,
}
