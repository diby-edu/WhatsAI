import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'
import {
    getDefaultPaymentProvider,
    initializeHostedPayment,
    inspectExistingHostedPayment,
    resolveHostedPaymentProvider,
} from '@/lib/payments/provider'

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params

    const clientId = getClientIdentifier(request)
    const rateCheck = await checkRateLimit(`payment:${clientId}`, RATE_LIMITS.payment)
    if (!rateCheck.success) {
        return rateLimitResponse(rateCheck.resetTime)
    }

    try {
        const adminSupabase = getSupabase()
        const { data: order, error } = await adminSupabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (error || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        if (order.status === 'paid') {
            return NextResponse.json({ error: 'Commande deja payee' }, { status: 400 })
        }

        if (order.payment_method && order.payment_method !== 'online') {
            return NextResponse.json({ error: 'Cette commande n utilise pas le paiement en ligne' }, { status: 400 })
        }

        const isDepositPayment = order.deposit_required && order.deposit_status === 'pending'
        const amountToCharge = Number(isDepositPayment ? order.deposit_amount_fcfa : order.total_fcfa)

        if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
            return NextResponse.json({ error: 'Montant de paiement invalide' }, { status: 400 })
        }

        const transactionId = `ORD_${orderId.substring(0, 8)}_${Date.now()}`
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
        const defaultProvider = await getDefaultPaymentProvider(adminSupabase)
        const paymentProvider = resolveHostedPaymentProvider({
            defaultProvider,
            storedProvider: order.payment_provider,
            transactionId: order.transaction_id,
            providerPaymentUrl: order.provider_payment_url,
        })

        if (order.transaction_id && order.provider_payment_url) {
            const existingPayment = await inspectExistingHostedPayment(
                paymentProvider,
                order.transaction_id,
                { providerVersion: order.payment_provider_version || null }
            )

            if (existingPayment.action === 'reuse') {
                return NextResponse.json({
                    success: true,
                    payment_url: order.provider_payment_url,
                    transaction_id: order.transaction_id,
                    provider: paymentProvider
                })
            }

            if (existingPayment.action === 'accepted') {
                return NextResponse.json({
                    error: 'Ce paiement a deja ete valide. Actualisez la commande dans quelques secondes.',
                    provider: paymentProvider,
                    provider_status: existingPayment.providerStatus,
                }, { status: 409 })
            }
        }

        const result = await initializeHostedPayment({
            provider: paymentProvider,
            amountFcfa: amountToCharge,
            currency: 'XOF',
            transactionId,
            description: isDepositPayment
                ? `Acompte commande #${orderId.substring(0, 8)}`
                : `Commande #${orderId.substring(0, 8)}`,
            customerName: order.customer_name || 'Client',
            customerEmail: order.customer_email || undefined,
            customerPhone: order.customer_phone || '',
            returnUrl: `${baseUrl}/pay/${orderId}`,
            failedUrl: `${baseUrl}/pay/${orderId}?payment=cancelled`,
            notifyUrl: `${baseUrl}/api/payments/${paymentProvider}/webhook`,
            metadata: {
                order_id: orderId,
                type: isDepositPayment ? 'order_deposit' : 'order_payment'
            },
            agentId: order.agent_id
        })

        if (!result.success || !result.paymentUrl) {
            return NextResponse.json({
                error: result.error || 'Erreur de paiement',
                details: result.raw || result
            }, { status: 400 })
        }

        await adminSupabase.from('orders').update({
            transaction_id: transactionId,
            payment_provider: paymentProvider,
            provider_transaction_id: result.providerTransactionId || null,
            provider_payment_url: result.paymentUrl,
            provider_notify_token: result.providerNotifyToken || null,
            payment_provider_version: result.providerVersion || 'v1',
            updated_at: new Date().toISOString()
        }).eq('id', orderId)

        return NextResponse.json({
            success: true,
            payment_url: result.paymentUrl,
            transaction_id: transactionId,
            provider: paymentProvider
        })
    } catch (err: any) {
        console.error('Hosted payment initiation error:', err)
        return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
    }
}
