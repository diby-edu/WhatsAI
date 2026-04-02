import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, isAdminRole } from '@/lib/api-utils'
import {
    canAccessPayment,
    findPaymentByIdentifiers,
    finalizePaymentRecord,
    getPaymentTransactionId,
    getUserRole,
} from '@/lib/payments/finalization'
import { checkHostedPaymentStatus, normalizePaymentProvider } from '@/lib/payments/provider'

// POST - Verify one payment and finalize through central pipeline
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const paymentId = String(body?.paymentId || '').trim()
        const transactionId = String(body?.transactionId || '').trim()

        if (!paymentId && !transactionId) {
            return NextResponse.json({ error: 'paymentId ou transactionId requis' }, { status: 400 })
        }

        const adminSupabase = createAdminClient()
        const payment = await findPaymentByIdentifiers(adminSupabase, [paymentId, transactionId], '*')

        if (!payment) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
        }

        const hasAccess = await canAccessPayment(adminSupabase, user.id, payment)
        if (!hasAccess) {
            return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
        }

        const txToCheck = getPaymentTransactionId(payment, [transactionId, paymentId])
        if (!txToCheck) {
            return NextResponse.json({ error: 'Transaction ID introuvable' }, { status: 400 })
        }

        const providerStatus = await checkHostedPaymentStatus(
            normalizePaymentProvider(payment.payment_provider),
            txToCheck
        )
        if (!providerStatus.success) {
            return NextResponse.json(
                {
                    error: 'Failed to check payment status',
                    provider_response: providerStatus,
                },
                { status: 400 }
            )
        }

        const finalized = await finalizePaymentRecord(
            adminSupabase,
            payment,
            providerStatus.status,
            providerStatus.raw || providerStatus
        )

        if (!finalized.ok) {
            return NextResponse.json({ error: finalized.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: finalized.message,
            credits_added: finalized.creditsAdded,
            new_balance: finalized.newBalance,
            plan_updated: finalized.planUpdated,
            current_status: finalized.payment?.status || payment.status,
            cinetpay_status: finalized.providerStatus,
            provider_status: finalized.providerStatus,
            finalization_state: finalized.state,
        })
    } catch (error) {
        console.error('Payment verify error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

// GET - Check pending/processing payments (admin only)
export async function GET() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()
    const role = await getUserRole(adminSupabase, user.id)
    if (!isAdminRole(role)) {
        return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    try {
        const { data: payments, error } = await adminSupabase
            .from('payments')
            .select('id, user_id, amount_fcfa, status, provider_transaction_id, transaction_id, created_at')
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            pending_payments: payments || [],
            count: payments?.length || 0,
        })
    } catch (error) {
        console.error('Payments verify GET error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
