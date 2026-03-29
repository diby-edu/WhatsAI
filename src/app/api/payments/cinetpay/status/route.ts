import { NextRequest, NextResponse } from 'next/server'
import { checkPaymentStatus } from '@/lib/payments/cinetpay'
import { createAdminClient, createApiClient, getAuthUser, isAdminRole } from '@/lib/api-utils'
import {
    canAccessPayment,
    findPaymentByIdentifiers,
    finalizePaymentByTransaction,
    getUserRole,
} from '@/lib/payments/finalization'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const transactionId = String(searchParams.get('transaction_id') || '').trim()
    const isPublicCheckoutTransaction = transactionId.startsWith('ORD_') || transactionId.startsWith('BKG_')

    if (!transactionId) {
        return NextResponse.json({ error: 'transaction_id requis' }, { status: 400 })
    }

    try {
        if (isPublicCheckoutTransaction) {
            const result = await checkPaymentStatus(transactionId)

            return NextResponse.json({
                success: result.status === 'ACCEPTED',
                status: result.status || 'UNKNOWN',
                transaction_id: transactionId,
                amount: result.amount,
                payment_method: result.message,
                payment_record_status: null,
                data: {
                    status: result.status || 'UNKNOWN',
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

        const result = await checkPaymentStatus(transactionId)

        return NextResponse.json({
            success: result.status === 'ACCEPTED',
            status: result.status || 'UNKNOWN',
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
