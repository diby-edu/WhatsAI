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

    const { data: order } = await adminSupabase
        .from('orders')
        .select('payment_provider, payment_provider_version')
        .eq('transaction_id', transactionId)
        .single()

    if (order) {
        return {
            provider: normalizePaymentProvider(order.payment_provider),
            providerVersion: order.payment_provider_version || 'v1',
        }
    }

    const { data: booking } = await adminSupabase
        .from('bookings')
        .select('payment_provider, payment_provider_version')
        .eq('transaction_id', transactionId)
        .single()

    return {
        provider: normalizePaymentProvider(booking?.payment_provider),
        providerVersion: booking?.payment_provider_version || 'v1',
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const transactionId = String(searchParams.get('transaction_id') || '').trim()
    const isPublicCheckoutTransaction = isPublicCheckoutTransactionId(transactionId)

    if (!transactionId) {
        return NextResponse.json({ error: 'transaction_id requis' }, { status: 400 })
    }

    try {
        if (isPublicCheckoutTransaction) {
            const adminSupabase = createAdminClient()
            const { provider, providerVersion } = await getPublicCheckoutProviderConfig(transactionId)
            const result = await checkHostedPaymentStatus(provider, transactionId, { providerVersion })
            const normalizedStatus = result.status || 'UNKNOWN'

            let finalizationState: string | null = null

            if (normalizedStatus === 'ACCEPTED') {
                const finalized = await finalizeHostedCheckoutTransaction(adminSupabase, transactionId, {
                    provider,
                    amount: result.amount ?? null,
                    providerPayload: result.raw || result,
                })

                finalizationState = finalized.state
            }

            return NextResponse.json({
                success: normalizedStatus === 'ACCEPTED',
                status: normalizedStatus,
                provider,
                provider_status: normalizedStatus,
                transaction_id: transactionId,
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

        const result = await checkHostedPaymentStatus(
            normalizePaymentProvider(payment?.payment_provider),
            transactionId
        )

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
        console.error('Payment status check error:', err)
        return NextResponse.json({ error: err.message || 'Erreur de verification' }, { status: 500 })
    }
}
