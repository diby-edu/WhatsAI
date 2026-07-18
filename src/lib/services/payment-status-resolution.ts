import { createAdminClient } from '@/lib/api-utils'
import { normalizePaymentProvider } from '@/lib/payments/provider'

export function isPublicCheckoutTransactionId(transactionId: string) {
    return transactionId.startsWith('ORD_')
        || transactionId.startsWith('ORD-')
        || transactionId.startsWith('BKG_')
        || transactionId.startsWith('BKG-')
}

export async function getPublicCheckoutProviderConfig(transactionId: string) {
    const adminSupabase = createAdminClient()

    const { data: orderByTx } = await adminSupabase
        .from('orders')
        .select('transaction_id, provider_transaction_id, payment_provider, payment_provider_version')
        .eq('transaction_id', transactionId)
        .maybeSingle()

    if (orderByTx) {
        return {
            found: true,
            provider: normalizePaymentProvider(orderByTx.payment_provider),
            providerVersion: orderByTx.payment_provider_version || 'v1',
            internalTransactionId: orderByTx.transaction_id || null,
            providerTransactionId: orderByTx.provider_transaction_id || null,
        }
    }

    const { data: orderByProviderTx } = await adminSupabase
        .from('orders')
        .select('transaction_id, provider_transaction_id, payment_provider, payment_provider_version')
        .eq('provider_transaction_id', transactionId)
        .maybeSingle()

    if (orderByProviderTx) {
        return {
            found: true,
            provider: normalizePaymentProvider(orderByProviderTx.payment_provider),
            providerVersion: orderByProviderTx.payment_provider_version || 'v1',
            internalTransactionId: orderByProviderTx.transaction_id || null,
            providerTransactionId: orderByProviderTx.provider_transaction_id || null,
        }
    }

    const { data: bookingByTx } = await adminSupabase
        .from('bookings')
        .select('transaction_id, provider_transaction_id, payment_provider, payment_provider_version')
        .eq('transaction_id', transactionId)
        .maybeSingle()

    if (bookingByTx) {
        return {
            found: true,
            provider: normalizePaymentProvider(bookingByTx.payment_provider),
            providerVersion: bookingByTx.payment_provider_version || 'v1',
            internalTransactionId: bookingByTx.transaction_id || null,
            providerTransactionId: bookingByTx.provider_transaction_id || null,
        }
    }

    const { data: bookingByProviderTx } = await adminSupabase
        .from('bookings')
        .select('transaction_id, provider_transaction_id, payment_provider, payment_provider_version')
        .eq('provider_transaction_id', transactionId)
        .maybeSingle()

    if (bookingByProviderTx) {
        return {
            found: true,
            provider: normalizePaymentProvider(bookingByProviderTx.payment_provider),
            providerVersion: bookingByProviderTx.payment_provider_version || 'v1',
            internalTransactionId: bookingByProviderTx.transaction_id || null,
            providerTransactionId: bookingByProviderTx.provider_transaction_id || null,
        }
    }

    return {
        found: false,
        provider: normalizePaymentProvider(null),
        providerVersion: 'v1',
        internalTransactionId: null,
        providerTransactionId: null,
    }
}
