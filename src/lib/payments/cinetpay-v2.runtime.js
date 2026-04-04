const accessTokenCache = {
    value: null,
    expiresAt: 0,
}

function getCinetPayV2BaseUrl() {
    return (process.env.CINETPAY_V2_BASE_URL || 'https://api.cinetpay.net').replace(/\/+$/, '')
}

function getCinetPayV2AccountKey() {
    return process.env.CINETPAY_V2_ACCOUNT_KEY || ''
}

function getCinetPayV2AccountPassword() {
    return process.env.CINETPAY_V2_ACCOUNT_PASSWORD || ''
}

function getCinetPayV2FallbackEmailDomain() {
    return process.env.CINETPAY_V2_FALLBACK_EMAIL_DOMAIN || 'wazzapai.com'
}

function getCinetPayV2TestAgentIds() {
    return String(process.env.CINETPAY_V2_TEST_AGENT_IDS || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
}

function isCinetPayV2Enabled() {
    return process.env.CINETPAY_V2_ENABLED === 'true'
}

function isCinetPayV2Configured() {
    return Boolean(
        isCinetPayV2Enabled() &&
        getCinetPayV2BaseUrl() &&
        getCinetPayV2AccountKey() &&
        getCinetPayV2AccountPassword() &&
        getCinetPayV2TestAgentIds().length > 0
    )
}

function shouldUseCinetPayV2ForAgent(agentId) {
    if (!agentId || !isCinetPayV2Configured()) {
        return false
    }

    return getCinetPayV2TestAgentIds().includes(String(agentId))
}

function splitCustomerName(fullName) {
    const normalized = String(fullName || '').trim().replace(/\s+/g, ' ')
    if (!normalized) {
        return { firstName: 'Client', lastName: 'Wazzapai' }
    }

    const parts = normalized.split(' ')
    if (parts.length === 1) {
        return { firstName: parts[0].slice(0, 255), lastName: 'Client' }
    }

    const [firstName, ...rest] = parts
    return {
        firstName: firstName.slice(0, 255),
        lastName: rest.join(' ').slice(0, 255) || 'Client',
    }
}

function buildClientEmail(email, phoneNumber) {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (/\S+@\S+\.\S+/.test(normalizedEmail)) {
        return normalizedEmail
    }

    const digits = String(phoneNumber || '').replace(/\D+/g, '')
    if (digits) {
        return `wa-${digits}@${getCinetPayV2FallbackEmailDomain()}`
    }

    return `client@${getCinetPayV2FallbackEmailDomain()}`
}

async function getAccessToken() {
    if (accessTokenCache.value && accessTokenCache.expiresAt > Date.now()) {
        return accessTokenCache.value
    }

    const response = await fetch(`${getCinetPayV2BaseUrl()}/v1/oauth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            api_key: getCinetPayV2AccountKey(),
            api_password: getCinetPayV2AccountPassword(),
        }),
    })

    let result = null
    try {
        result = await response.json()
    } catch (_error) {}

    if (!response.ok || Number(result?.code) !== 200 || !result?.access_token) {
        throw new Error(result?.description || result?.message || `CinetPay v2 auth failed (${response.status})`)
    }

    const expiresIn = Number(result?.expires_in || 3600)
    accessTokenCache.value = result.access_token
    accessTokenCache.expiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000

    return accessTokenCache.value
}

async function authenticatedRequest(path, init = {}) {
    const accessToken = await getAccessToken()
    const headers = {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        Authorization: `Bearer ${accessToken}`,
    }

    const response = await fetch(`${getCinetPayV2BaseUrl()}${path}`, {
        ...init,
        headers,
    })

    let result = null
    try {
        result = await response.json()
    } catch (_error) {}

    return { response, result }
}

async function initializePaymentV2(data) {
    const { firstName, lastName } = splitCustomerName(data.clientFullName)
    const clientEmail = buildClientEmail(data.clientEmail, data.clientPhoneNumber)

    const payload = {
        currency: data.currency,
        payment_method: data.paymentMethod,
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

    if (data.otpCode) {
        payload.otp_code = String(data.otpCode)
    }

    const { response, result } = await authenticatedRequest('/v1/payment', {
        method: 'POST',
        body: JSON.stringify(payload),
    })

    if (!response.ok || Number(result?.code) !== 200 || String(result?.status || '').toUpperCase() !== 'OK') {
        return {
            success: false,
            error: result?.description || result?.message || `CinetPay v2 init failed (${response.status})`,
        }
    }

    if (!result?.payment_url) {
        return {
            success: false,
            error: result?.details?.message || 'CinetPay v2 did not return a payment URL',
        }
    }

    return {
        success: true,
        paymentUrl: result.payment_url,
        paymentToken: result.payment_token,
        notifyToken: result.notify_token,
        providerTransactionId: result.transaction_id,
        merchantTransactionId: result.merchant_transaction_id,
        status: result?.details?.status,
        mustBeRedirected: Boolean(result?.details?.must_be_redirected),
        message: result?.details?.message || null,
    }
}

module.exports = {
    initializePaymentV2,
    isCinetPayV2Configured,
    isCinetPayV2Enabled,
    shouldUseCinetPayV2ForAgent,
    splitCustomerName,
}
