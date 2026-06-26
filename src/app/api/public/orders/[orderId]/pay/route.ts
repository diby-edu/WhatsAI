import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'
import {
    getDefaultPaymentProvider,
    initializeHostedPayment,
    inspectExistingHostedPayment,
    resolveHostedPaymentProvider,
} from '@/lib/payments/provider'
import { getFeexPayDefaultNetwork } from '@/lib/payments/feexpay'
import {
    getFeexPayNetworkOption,
    resolveFeexPaySelection,
} from '@/lib/payments/feexpay-networks'

function buildPayTraceId(orderId: string) {
    return `pay_${orderId.slice(0, 8)}_${Date.now()}`
}

function maskPhone(value: unknown) {
    const raw = String(value || '').replace(/\s+/g, '')
    if (!raw) return null
    if (raw.length <= 6) return raw
    return `${raw.slice(0, 3)}***${raw.slice(-3)}`
}

function safeHost(url: unknown) {
    const value = String(url || '').trim()
    if (!value) return null
    try {
        return new URL(value).host
    } catch {
        return null
    }
}

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params
    const traceId = buildPayTraceId(orderId)
    let body: Record<string, any> = {}
    try {
        const rawBody = await request.text()
        if (rawBody.trim()) {
            body = JSON.parse(rawBody)
        }
    } catch {
        body = {}
    }

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

        console.info('[PAY][INIT][REQUEST]', {
            traceId,
            orderId,
            amountToCharge,
            isDepositPayment,
            defaultProvider,
            paymentProvider,
            customerPhone: maskPhone(order.customer_phone),
            hasCustomerEmail: Boolean(String(order.customer_email || '').trim()),
            bodyFeexpayCountry: String(body.feexpay_country || '').trim() || null,
            bodyFeexpayNetwork: String(body.feexpay_network || '').trim() || null,
        })

        const existingProviderReference = String(order.provider_transaction_id || order.transaction_id || '').trim()
        if (existingProviderReference) {
            const existingPayment = await inspectExistingHostedPayment(
                paymentProvider,
                existingProviderReference,
                { providerVersion: order.payment_provider_version || null }
            )

            if (existingPayment.action === 'reuse') {
                const existingPaymentUrl = String(order.provider_payment_url || '').trim()
                    || `${baseUrl}/payment/success?transaction_id=${encodeURIComponent(String(order.transaction_id || existingProviderReference).trim())}&payment=pending`
                console.info('[PAY][INIT][REUSE_EXISTING]', {
                    traceId,
                    orderId,
                    paymentProvider,
                    existingProviderReference,
                    reusedUrlHost: safeHost(existingPaymentUrl),
                })
                return NextResponse.json({
                    success: true,
                    payment_url: existingPaymentUrl,
                    transaction_id: String(order.transaction_id || existingProviderReference).trim(),
                    provider: paymentProvider
                })
            }

            if (existingPayment.action === 'accepted') {
                console.info('[PAY][INIT][ALREADY_ACCEPTED]', {
                    traceId,
                    orderId,
                    paymentProvider,
                    existingProviderReference,
                    providerStatus: existingPayment.providerStatus,
                })
                return NextResponse.json({
                    error: 'Ce paiement a deja ete valide. Actualisez la commande dans quelques secondes.',
                    provider: paymentProvider,
                    provider_status: existingPayment.providerStatus,
                }, { status: 409 })
            }
        }

        const metadata: Record<string, any> = {
            order_id: orderId,
            type: isDepositPayment ? 'order_deposit' : 'order_payment'
        }

        if (paymentProvider === 'feexpay') {
            const selection = resolveFeexPaySelection({
                country: body.feexpay_country,
                network: body.feexpay_network,
                phone: order.customer_phone || '',
                defaultNetwork: getFeexPayDefaultNetwork(),
            })

            if (selection.error === 'NETWORK_COUNTRY_MISMATCH') {
                return NextResponse.json({
                    error: 'Le reseau de paiement ne correspond pas au pays choisi',
                }, { status: 400 })
            }

            if (!selection.networkCode || !selection.countryCode) {
                return NextResponse.json({
                    error: 'Selection FeexPay incomplete: choisissez un pays et un reseau',
                }, { status: 400 })
            }

            const networkOption = getFeexPayNetworkOption(selection.networkCode)
            metadata.feexpay_country = selection.countryCode
            metadata.feexpay_network = selection.networkCode
            metadata.payment_channel = 'mobile_money'
            metadata.payment_channel_detail = selection.networkCode
            metadata.payment_channel_label = networkOption?.label || selection.networkCode

            console.info('[PAY][INIT][FEEXPAY_SELECTION]', {
                traceId,
                orderId,
                countryCode: selection.countryCode,
                networkCode: selection.networkCode,
                networkLabel: networkOption?.label || selection.networkCode,
            })
        }

        console.info('[PAY][INIT][PROVIDER_CALL]', {
            traceId,
            orderId,
            provider: paymentProvider,
            transactionId,
            notifyHost: safeHost(`${baseUrl}/api/payments/${paymentProvider}/webhook`),
            returnHost: safeHost(`${baseUrl}/pay/${orderId}`),
        })

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
            returnUrl: `${baseUrl}/pay/${orderId}?status=success`,
            failedUrl: `${baseUrl}/pay/${orderId}?payment=cancelled`,
            notifyUrl: `${baseUrl}/api/payments/${paymentProvider}/webhook`,
            metadata,
            agentId: order.agent_id
        })

        console.info('[PAY][INIT][PROVIDER_RESULT]', {
            traceId,
            orderId,
            provider: paymentProvider,
            providerSuccess: result.success,
            hasPaymentUrl: Boolean(String(result.paymentUrl || '').trim()),
            paymentUrlHost: safeHost(result.paymentUrl),
            providerTransactionId: result.providerTransactionId || null,
            providerVersion: result.providerVersion || null,
            error: result.error || null,
        })

        if (!result.success || !result.paymentUrl) {
            console.warn('[PAY][INIT][FAILED_NO_URL]', {
                traceId,
                orderId,
                provider: paymentProvider,
                providerSuccess: result.success,
                hasPaymentUrl: Boolean(String(result.paymentUrl || '').trim()),
                error: result.error || null,
            })
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
        console.error('[PAY][INIT][UNCAUGHT_ERROR]', {
            traceId,
            orderId,
            message: err?.message || 'unknown error',
            stack: err?.stack || null,
        })
        return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
    }
}
