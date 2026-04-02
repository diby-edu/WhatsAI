import type { SupabaseClient } from '@supabase/supabase-js'
import { checkPaymentStatus, initializePayment, checkPaymentStatusV2Runtime } from '@/lib/payments/cinetpay'
import { initializePaymentV2, shouldUseCinetPayV2ForAgent } from '@/lib/payments/cinetpay-v2'
import {
    initializePaystackPayment,
    resolvePaystackCustomerEmail,
    verifyPaystackTransaction,
} from '@/lib/payments/paystack'

export type SupportedPaymentProvider = 'cinetpay' | 'paystack'
export type ProviderStatus = 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'CANCELLED' | 'UNKNOWN'

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

function normalizeProviderStatus(status: unknown): ProviderStatus {
    const value = String(status || '').trim().toUpperCase()
    if (value === 'SUCCESS') return 'ACCEPTED'
    if (value === 'FAILED' || value === 'INSUFFICIENT_BALANCE') return 'REFUSED'
    if (value === 'EXPIRED') return 'CANCELLED'
    if (value === 'INITIATED') return 'PENDING'
    if (value === 'ABANDONED') return 'CANCELLED'
    if (value === 'ACCEPTED') return 'ACCEPTED'
    if (value === 'REFUSED') return 'REFUSED'
    if (value === 'CANCELLED') return 'CANCELLED'
    if (value === 'PENDING') return 'PENDING'
    return 'UNKNOWN'
}

export function normalizePaymentProvider(value: unknown): SupportedPaymentProvider {
    return String(value || '').trim().toLowerCase() === 'paystack'
        ? 'paystack'
        : 'cinetpay'
}

export async function getDefaultPaymentProvider(adminSupabase: SupabaseLike): Promise<SupportedPaymentProvider> {
    const { data } = await adminSupabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['defaultPaymentProvider', 'default_payment_provider'])

    const explicit = (data || []).find((row: any) => row.key === 'defaultPaymentProvider')
        || (data || []).find((row: any) => row.key === 'default_payment_provider')

    return normalizePaymentProvider(explicit?.value)
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

    if (provider === 'paystack') {
        const result = await initializePaystackPayment({
            amountFcfa: input.amountFcfa,
            currency: input.currency || 'XOF',
            reference: input.transactionId,
            description: input.description,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
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
