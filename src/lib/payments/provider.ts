import type { SupabaseClient } from '@supabase/supabase-js'
import { checkPaymentStatus, initializePayment, checkPaymentStatusV2Runtime } from '@/lib/payments/cinetpay'
import { initializePaymentV2, shouldUseCinetPayV2ForAgent } from '@/lib/payments/cinetpay-v2'
import {
    initializePaystackPayment,
    resolvePaystackCustomerEmail,
    verifyPaystackTransaction,
} from '@/lib/payments/paystack'
import {
    getFeexPayDefaultNetwork,
    initializeFeexPayPayment,
    networkRequiresOtp,
    verifyFeexPayTransaction,
} from '@/lib/payments/feexpay'

export type SupportedPaymentProvider = 'cinetpay' | 'paystack' | 'feexpay'
export type ProviderStatus = 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'
export type HostedPaymentReuseAction = 'reuse' | 'regenerate' | 'accepted'

type SupabaseLike = SupabaseClient | any

export interface HostedPaymentInitInput {
    provider: SupportedPaymentProvider
    amountFcfa: number
    currency?: string
    transactionId: string
    description: string
    customerName: string
    customerEmail?: string
    customerPhone?: string
    returnUrl: string
    failedUrl?: string
    notifyUrl: string
    metadata?: Record<string, any>
    agentId?: string | null
}

export interface HostedPaymentInitResult {
    success: boolean
    provider: SupportedPaymentProvider
    paymentUrl?: string
    transactionId: string
    providerTransactionId?: string | null
    providerNotifyToken?: string | null
    providerVersion?: string | null
    error?: string
    raw?: unknown
}

export interface HostedPaymentStatusResult {
    success: boolean
    status: ProviderStatus
    transactionId: string
    amount?: number | null
    message?: string | null
    raw?: unknown
}

export interface PaymentProviderReadiness {
    provider: SupportedPaymentProvider
    ready: boolean
    requiredKeys: string[]
    missingKeys: string[]
    warnings: string[]
}

export interface ExistingHostedPaymentDecision {
    provider: SupportedPaymentProvider
    action: HostedPaymentReuseAction
    providerStatus: ProviderStatus
    error?: string | null
}

function normalizeProviderStatus(status: unknown): ProviderStatus {
    const value = String(status || '').trim().toUpperCase()
    if (value === 'SUCCESS' || value === 'SUCCESSFUL') return 'ACCEPTED'
    if (value === 'FAILED' || value === 'INSUFFICIENT_BALANCE') return 'REFUSED'
    if (value === 'EXPIRED') return 'CANCELLED'
    if (value === 'INITIATED' || value === 'IN PENDING STATE') return 'PENDING'
    if (value === 'ABANDONED') return 'CANCELLED'
    if (value === 'ACCEPTED') return 'ACCEPTED'
    if (value === 'REFUSED') return 'REFUSED'
    if (value === 'CANCELLED') return 'CANCELLED'
    if (value === 'PENDING') return 'PENDING'
    return 'UNKNOWN'
}

export function parsePaymentProvider(value: unknown): SupportedPaymentProvider | null {
    const normalized = String(value || '').trim().toLowerCase()
    if (!normalized) return null
    // Accept common typo/alias used by operators ("FeePay")
    if (normalized === 'feepay') return 'feexpay'
    if (normalized === 'paystack' || normalized === 'cinetpay' || normalized === 'feexpay') {
        return normalized
    }
    return null
}

export function normalizePaymentProvider(
    value: unknown,
    fallback: SupportedPaymentProvider = 'cinetpay'
): SupportedPaymentProvider {
    const parsed = parsePaymentProvider(value)
    if (parsed) {
        return parsed
    }

    const normalized = String(value || '').trim()
    if (normalized) {
        throw new Error(`Unsupported payment provider: ${normalized}`)
    }

    return fallback
}

export function resolveHostedPaymentProvider(params: {
    defaultProvider: unknown
    storedProvider?: unknown
    transactionId?: unknown
    providerPaymentUrl?: unknown
}): SupportedPaymentProvider {
    const defaultProvider = normalizePaymentProvider(params.defaultProvider)
    const storedProvider = parsePaymentProvider(params.storedProvider)
    const hasPersistedHostedPayment = Boolean(
        String(params.transactionId || '').trim()
        || String(params.providerPaymentUrl || '').trim()
    )

    if (hasPersistedHostedPayment && storedProvider) {
        return storedProvider
    }

    return defaultProvider
}

export function getPaymentProviderReadiness(providerInput: unknown): PaymentProviderReadiness {
    const provider = normalizePaymentProvider(providerInput)

    if (provider === 'feexpay') {
        const requiredKeys = ['FEEXPAY_API_KEY', 'FEEXPAY_SHOP_ID', 'FEEXPAY_DEFAULT_NETWORK', 'NEXT_PUBLIC_APP_URL']
        const missingKeys = requiredKeys.filter((key) => !String(process.env[key] || '').trim())
        const warnings: string[] = []
        const defaultNetwork = getFeexPayDefaultNetwork()

        if (networkRequiresOtp(defaultNetwork) && !String(process.env.FEEXPAY_DEFAULT_OTP || '').trim()) {
            warnings.push(`FEEXPAY_DEFAULT_OTP is recommended for network ${defaultNetwork}`)
        }

        return {
            provider,
            ready: missingKeys.length === 0,
            requiredKeys,
            missingKeys,
            warnings,
        }
    }

    if (provider === 'paystack') {
        const requiredKeys = ['PAYSTACK_SECRET_KEY', 'NEXT_PUBLIC_APP_URL']
        const missingKeys = requiredKeys.filter((key) => !String(process.env[key] || '').trim())
        const warnings: string[] = []

        if (!String(process.env.PAYSTACK_PUBLIC_KEY || '').trim()) {
            warnings.push('PAYSTACK_PUBLIC_KEY is not configured')
        }

        return {
            provider,
            ready: missingKeys.length === 0,
            requiredKeys,
            missingKeys,
            warnings,
        }
    }

    const requiredKeys = ['CINETPAY_API_KEY', 'CINETPAY_SITE_ID', 'NEXT_PUBLIC_APP_URL']
    const missingKeys = requiredKeys.filter((key) => !String(process.env[key] || '').trim())

    return {
        provider,
        ready: missingKeys.length === 0,
        requiredKeys,
        missingKeys,
        warnings: [],
    }
}

export function ensurePaymentProviderReady(providerInput: unknown): SupportedPaymentProvider {
    const readiness = getPaymentProviderReadiness(providerInput)
    if (!readiness.ready) {
        throw new Error(
            `${readiness.provider} is not ready: missing ${readiness.missingKeys.join(', ')}`
        )
    }
    return readiness.provider
}

export async function getDefaultPaymentProvider(adminSupabase: SupabaseLike): Promise<SupportedPaymentProvider> {
    const { data, error } = await adminSupabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['defaultPaymentProvider', 'default_payment_provider'])

    if (error) {
        throw new Error(`Unable to load default payment provider: ${error.message || 'unknown error'}`)
    }

    const explicit = (data || []).find((row: any) => row.key === 'defaultPaymentProvider')
        || (data || []).find((row: any) => row.key === 'default_payment_provider')

    if (explicit?.value === null || explicit?.value === undefined || String(explicit.value).trim() === '') {
        return 'cinetpay'
    }

    return normalizePaymentProvider(explicit.value)
}

function buildCinetPayFallbackEmail(customerEmail: string | undefined, transactionId: string, customerPhone: string | undefined) {
    const normalized = String(customerEmail || '').trim()
    if (normalized) return normalized
    return resolvePaystackCustomerEmail(undefined, transactionId, customerPhone)
}

function appendQueryParam(url: string, key: string, value: string) {
    try {
        const target = new URL(url)
        target.searchParams.set(key, value)
        return target.toString()
    } catch {
        const separator = url.includes('?') ? '&' : '?'
        return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    }
}

function normalizeCinetPayV2Currency(currency?: string): 'XOF' | 'XAF' | 'GNF' | 'CDF' {
    const value = String(currency || 'XOF').trim().toUpperCase()
    if (value === 'XAF' || value === 'GNF' || value === 'CDF') {
        return value
    }
    return 'XOF'
}

export async function initializeHostedPayment(input: HostedPaymentInitInput): Promise<HostedPaymentInitResult> {
    const provider = normalizePaymentProvider(input.provider)
    ensurePaymentProviderReady(provider)

    if (provider === 'feexpay') {
        const result = await initializeFeexPayPayment({
            amountFcfa: input.amountFcfa,
            transactionId: input.transactionId,
            description: input.description,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            returnUrl: input.returnUrl,
            failedUrl: input.failedUrl,
            metadata: input.metadata,
        })

        const network = String((result.raw as any)?.network || '').trim().toLowerCase()
        const paymentUrl = String(result.paymentUrl || '').trim()
        const fallbackPendingUrl = appendQueryParam(
            appendQueryParam(input.returnUrl, 'transaction_id', input.transactionId),
            'payment',
            'pending'
        )
        const resolvedPaymentUrl = paymentUrl || fallbackPendingUrl

        return {
            success: Boolean(result.success && resolvedPaymentUrl),
            provider,
            paymentUrl: resolvedPaymentUrl || undefined,
            transactionId: input.transactionId,
            providerTransactionId: result.reference || input.transactionId,
            providerNotifyToken: null,
            providerVersion: 'v1',
            error: result.success
                ? undefined
                : (result.error || `Le reseau FeexPay ${network || 'configure'} n a pas permis d initier le paiement`),
            raw: result.raw || result,
        }
    }

    if (provider === 'paystack') {
        const result = await initializePaystackPayment({
            amountFcfa: input.amountFcfa,
            currency: input.currency || 'XOF',
            reference: input.transactionId,
            description: input.description,
            customerName: input.customerName,
            customerEmail: resolvePaystackCustomerEmail(
                input.customerEmail,
                input.transactionId,
                input.customerPhone
            ),
            customerPhone: input.customerPhone,
            callbackUrl: input.returnUrl,
            metadata: input.metadata,
        })

        return {
            success: result.success,
            provider,
            paymentUrl: result.paymentUrl,
            transactionId: input.transactionId,
            providerTransactionId: result.reference || input.transactionId,
            providerNotifyToken: null,
            providerVersion: 'v1',
            error: result.error,
            raw: result.raw,
        }
    }

    const useCinetPayV2 = Boolean(input.agentId) && shouldUseCinetPayV2ForAgent(String(input.agentId))
    if (useCinetPayV2) {
        const result = await initializePaymentV2({
            amount: input.amountFcfa,
            currency: normalizeCinetPayV2Currency(input.currency),
            merchantTransactionId: input.transactionId,
            designation: input.description,
            clientFullName: input.customerName,
            clientPhoneNumber: input.customerPhone || '',
            successUrl: input.returnUrl,
            failedUrl: input.failedUrl || appendQueryParam(input.returnUrl, 'payment', 'cancelled'),
            notifyUrl: input.notifyUrl,
        })

        return {
            success: Boolean(result.success && result.paymentUrl),
            provider,
            paymentUrl: result.paymentUrl,
            transactionId: input.transactionId,
            providerTransactionId: result.providerTransactionId || null,
            providerNotifyToken: result.notifyToken || null,
            providerVersion: 'v2',
            error: result.error,
            raw: result.raw || result,
        }
    }

    const result = await initializePayment({
        amount: input.amountFcfa,
        currency: input.currency || 'XOF',
        transactionId: input.transactionId,
        description: input.description,
        customerName: input.customerName,
        customerEmail: buildCinetPayFallbackEmail(input.customerEmail, input.transactionId, input.customerPhone),
        customerPhone: input.customerPhone || '',
        returnUrl: input.returnUrl,
        notifyUrl: input.notifyUrl,
        metadata: input.metadata,
    })

    return {
        success: Boolean(result.success && result.paymentUrl),
        provider,
        paymentUrl: result.paymentUrl,
        transactionId: input.transactionId,
        providerTransactionId: null,
        providerNotifyToken: null,
        providerVersion: 'v1',
        error: result.error,
        raw: result,
    }
}

export async function checkHostedPaymentStatus(
    providerInput: unknown,
    transactionId: string,
    options?: { providerVersion?: string | null }
): Promise<HostedPaymentStatusResult> {
    const provider = normalizePaymentProvider(providerInput)

    if (provider === 'feexpay') {
        return verifyFeexPayTransaction(transactionId)
    }

    if (provider === 'paystack') {
        return verifyPaystackTransaction(transactionId)
    }

    if (options?.providerVersion === 'v2') {
        const result = await checkPaymentStatusV2Runtime(transactionId)
        return {
            success: true,
            status: normalizeProviderStatus(result.status),
            transactionId,
            amount: result.amount ?? null,
            message: result.message ?? null,
            raw: result,
        }
    }

    const result = await checkPaymentStatus(transactionId)
    return {
        success: Boolean(result.success),
        status: normalizeProviderStatus(result.status),
        transactionId,
        amount: result.amount ?? null,
        message: result.message ?? null,
        raw: result,
    }
}

export async function inspectExistingHostedPayment(
    providerInput: unknown,
    transactionId: string,
    options?: { providerVersion?: string | null }
): Promise<ExistingHostedPaymentDecision> {
    const provider = normalizePaymentProvider(providerInput)
    const providerResult = await checkHostedPaymentStatus(provider, transactionId, options)

    if (!providerResult.success) {
        return {
            provider,
            action: 'regenerate',
            providerStatus: 'UNKNOWN',
            error: providerResult.message || 'provider status check failed',
        }
    }

    if (providerResult.status === 'PENDING') {
        return {
            provider,
            action: 'reuse',
            providerStatus: providerResult.status,
            error: null,
        }
    }

    if (providerResult.status === 'ACCEPTED') {
        return {
            provider,
            action: 'accepted',
            providerStatus: providerResult.status,
            error: null,
        }
    }

    return {
        provider,
        action: 'regenerate',
        providerStatus: providerResult.status,
        error: null,
    }
}
