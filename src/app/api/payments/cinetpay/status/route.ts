import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, isAdminRole } from '@/lib/api-utils'
import {
    canAccessPayment,
    findPaymentByIdentifiers,
    finalizePaymentByTransaction,
    getUserRole,
} from '@/lib/payments/finalization'
import { finalizeHostedCheckoutTransaction } from '@/lib/payments/hosted-checkout-finalization'
import { checkHostedPaymentStatus, normalizePaymentProvider } from '@/lib/payments/provider'

function isPublicCheckoutTransactionId(transactionId: string) {
    return transactionId.startsWith('ORD_')
        || transactionId.startsWith('ORD-')
        || transactionId.startsWith('BKG_')
        || transactionId.startsWith('BKG-')
}

async function getPublicCheckoutProviderConfig(transactionId: string) {
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

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const transactionId = String(searchParams.get('transaction_id') || '').trim()

    if (!transactionId) {
        return NextResponse.json({ error: 'transaction_id requis' }, { status: 400 })
    }

    try {
        console.info('[PAY][STATUS][GET_REQUEST]', {
            transactionId,
            publicTxPattern: isPublicCheckoutTransactionId(transactionId),
        })

        const publicCheckoutConfig = await getPublicCheckoutProviderConfig(transactionId)
        if (isPublicCheckoutTransactionId(transactionId) || publicCheckoutConfig.found) {
            const adminSupabase = createAdminClient()
            const provider = publicCheckoutConfig.provider
            const providerVersion = publicCheckoutConfig.providerVersion
            const providerReference = publicCheckoutConfig.providerTransactionId || transactionId
            const internalTransactionId = publicCheckoutConfig.internalTransactionId || transactionId

            console.info('[PAY][STATUS][PUBLIC_RESOLVED]', {
                transactionId,
                foundConfig: publicCheckoutConfig.found,
                provider,
                providerVersion,
                providerReference,
                internalTransactionId,
            })

            const result = await checkHostedPaymentStatus(provider, providerReference, { providerVersion })
            const normalizedStatus = result.status || 'UNKNOWN'

            let finalizationState: string | null = null

            if (normalizedStatus === 'ACCEPTED') {
                const finalized = await finalizeHostedCheckoutTransaction(adminSupabase, internalTransactionId, {
                    provider,
                    amount: result.amount ?? null,
                    providerPayload: result.raw || result,
                })

                finalizationState = finalized.state
                console.info('[PAY][STATUS][PUBLIC_FINALIZATION]', {
                    internalTransactionId,
                    providerReference,
                    provider,
                    finalizationState,
                })
            }

            console.info('[PAY][STATUS][PUBLIC_RESULT]', {
                internalTransactionId,
                providerReference,
                provider,
                providerStatus: normalizedStatus,
                amount: result.amount ?? null,
                message: result.message ?? null,
                finalizationState,
            })

            return NextResponse.json({
                success: normalizedStatus === 'ACCEPTED',
                status: normalizedStatus,
                provider,
                provider_status: normalizedStatus,
                transaction_id: internalTransactionId,
                provider_transaction_id: providerReference,
                amount: result.amount,
                payment_method: result.message,
                payment_record_status: null,
                finalization_state: finalizationState,
                data: {
                    status: normalizedStatus,
                    provider_status: result.status || 'UNKNOWN',
                },
            })
        }

        const apiSupabase = await createApiClient()
        const { user, error: authError } = await getAuthUser(apiSupabase)

        if (authError || !user) {
            return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
        }

        const adminSupabase = createAdminClient()
        const payment = await findPaymentByIdentifiers(adminSupabase, [transactionId], '*')

        if (payment) {
            const allowed = await canAccessPayment(adminSupabase, user.id, payment)
            if (!allowed) {
                return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
            }
        } else {
            const role = await getUserRole(adminSupabase, user.id)
            if (!isAdminRole(role)) {
                return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
            }
        }

        const statusReference = String(
            payment?.provider_transaction_id
            || payment?.transaction_id
            || transactionId
            || ''
        ).trim()
        const result = await checkHostedPaymentStatus(
            normalizePaymentProvider(payment?.payment_provider),
            statusReference || transactionId,
            { providerVersion: payment?.payment_provider_version || null }
        )

        console.info('[PAY][STATUS][AUTH_RESULT]', {
            transactionId,
            userId: user.id,
            provider: normalizePaymentProvider(payment?.payment_provider),
            statusReference: statusReference || transactionId,
            paymentRecordStatus: payment?.status || null,
            providerStatus: result.status || 'UNKNOWN',
            amount: result.amount ?? null,
        })

        return NextResponse.json({
            success: result.status === 'ACCEPTED',
            status: result.status || 'UNKNOWN',
            provider: normalizePaymentProvider(payment?.payment_provider),
            transaction_id: transactionId,
            amount: result.amount,
            payment_method: result.message,
            payment_record_status: payment?.status || null,
            data: {
                status: result.status || 'UNKNOWN',
            },
        })
    } catch (err: any) {
        console.error('[PAY][STATUS][GET_ERROR]', {
            transactionId,
            message: err?.message || 'Erreur de verification',
            stack: err?.stack || null,
        })
        return NextResponse.json({ error: err.message || 'Erreur de verification' }, { status: 500 })
    }
}

// POST - Verify and finalize via centralized finalization pipeline
export async function POST(request: NextRequest) {
    const apiSupabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(apiSupabase)

    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const transactionId = String(body?.transaction_id || '').trim()

        if (!transactionId) {
            return NextResponse.json({ error: 'transaction_id requis' }, { status: 400 })
        }

        const adminSupabase = createAdminClient()
        const payment = await findPaymentByIdentifiers(adminSupabase, [transactionId], '*')

        if (payment) {
            const allowed = await canAccessPayment(adminSupabase, user.id, payment)
            if (!allowed) {
                return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
            }
        } else {
            const role = await getUserRole(adminSupabase, user.id)
            if (!isAdminRole(role)) {
                return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
            }
        }

        const finalized = await finalizePaymentByTransaction(adminSupabase, transactionId)

        if (finalized.state === 'not_found') {
            return NextResponse.json({ error: finalized.message }, { status: 404 })
        }

        if (!finalized.ok) {
            return NextResponse.json({ error: finalized.message }, { status: 500 })
        }

        console.info('[PAY][STATUS][POST_FINALIZE]', {
            transactionId,
            userId: user.id,
            providerStatus: finalized.providerStatus,
            finalizationState: finalized.state,
            creditsAdded: finalized.creditsAdded,
            planUpdated: finalized.planUpdated,
        })

        return NextResponse.json({
            success: finalized.providerStatus === 'ACCEPTED',
            status: finalized.providerStatus,
            transaction_id: transactionId,
            message: finalized.message,
            credits_added: finalized.creditsAdded,
            new_balance: finalized.newBalance,
            finalization_state: finalized.state,
            data: {
                status: finalized.providerStatus,
            },
        })
    } catch (err: any) {
        console.error('[PAY][STATUS][POST_ERROR]', {
            message: err?.message || 'Erreur de verification',
            stack: err?.stack || null,
        })
        return NextResponse.json({ error: err.message || 'Erreur de verification' }, { status: 500 })
    }
}
