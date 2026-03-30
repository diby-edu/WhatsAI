import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'
import { initializePaymentV2, shouldUseCinetPayV2ForAgent } from '@/lib/payments/cinetpay-v2'

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID
const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2/payment'

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
        const { data: order, error } = await getSupabase()
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
        const useCinetPayV2 = shouldUseCinetPayV2ForAgent(order.agent_id)

        if (!useCinetPayV2 && (!CINETPAY_API_KEY || !CINETPAY_SITE_ID)) {
            return NextResponse.json({ error: 'CinetPay non configure' }, { status: 500 })
        }

        if (useCinetPayV2) {
            const result = await initializePaymentV2({
                amount: amountToCharge,
                currency: 'XOF',
                merchantTransactionId: transactionId,
                designation: isDepositPayment
                    ? `Acompte commande #${orderId.substring(0, 8)}`
                    : `Commande #${orderId.substring(0, 8)}`,
                clientFullName: order.customer_name || 'Client',
                clientPhoneNumber: order.customer_phone || '',
                successUrl: `${baseUrl}/pay/${orderId}?status=success`,
                failedUrl: `${baseUrl}/pay/${orderId}?status=cancelled`,
                notifyUrl: `${baseUrl}/api/payments/cinetpay/webhook`,
            })

            if (!result.success || !result.paymentUrl) {
                return NextResponse.json({
                    error: result.error || 'Erreur CinetPay',
                    details: result.raw || result
                }, { status: 400 })
            }

            await getSupabase().from('orders').update({
                transaction_id: transactionId,
                provider_transaction_id: result.providerTransactionId || null,
                provider_payment_url: result.paymentUrl,
                provider_notify_token: result.notifyToken || null,
                payment_provider_version: 'v2',
                updated_at: new Date().toISOString()
            }).eq('id', orderId)

            return NextResponse.json({
                success: true,
                payment_url: result.paymentUrl,
                transaction_id: transactionId
            })
        }

        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: transactionId,
            amount: amountToCharge,
            currency: 'XOF',
            description: isDepositPayment
                ? `Acompte commande #${orderId.substring(0, 8)}`
                : `Commande #${orderId.substring(0, 8)}`,
            notify_url: `${baseUrl}/api/payments/cinetpay/webhook`,
            return_url: `${baseUrl}/pay/${orderId}?status=success`,
            cancel_url: `${baseUrl}/pay/${orderId}?status=cancelled`,
            channels: 'ALL',
            customer_id: orderId,
            customer_name: 'Client',
            customer_surname: '',
            customer_phone_number: order.customer_phone || '',
            metadata: JSON.stringify({
                order_id: orderId,
                type: isDepositPayment ? 'order_deposit' : 'order_payment'
            })
        }

        const response = await fetch(CINETPAY_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const result = await response.json()
        console.log('CinetPay response:', result)

        if (result.code === '201') {
            await getSupabase().from('orders').update({
                transaction_id: transactionId,
                payment_provider_version: 'v1',
                updated_at: new Date().toISOString()
            }).eq('id', orderId)

            return NextResponse.json({
                success: true,
                payment_url: result.data.payment_url,
                transaction_id: transactionId
            })
        }

        return NextResponse.json({
            error: result.message || 'Erreur CinetPay',
            details: result
        }, { status: 400 })
    } catch (err: any) {
        console.error('CinetPay initiation error:', err)
        return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
    }
}
