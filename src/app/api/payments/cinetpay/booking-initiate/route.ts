import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, errorResponse, getAuthUser } from '@/lib/api-utils'
import {
    getDefaultPaymentProvider,
    initializeHostedPayment,
    inspectExistingHostedPayment,
    normalizePaymentProvider,
} from '@/lib/payments/provider'

function isFullBookingPayment(booking: {
    booking_source?: string | null
    payment_method?: string | null
    price_fcfa?: number | null
    deposit_amount_fcfa?: number | null
}) {
    const total = Number(booking.price_fcfa || 0)
    const charged = Number(booking.deposit_amount_fcfa || 0)
    return booking.booking_source !== 'restaurant'
        && booking.payment_method === 'online'
        && total > 0
        && charged >= total
}

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const body = await request.json()
        const bookingId = String(body?.booking_id || '').trim()

        if (!bookingId) {
            return errorResponse('booking_id is required', 400)
        }

        const adminSupabase = createAdminClient()
        const { data: booking, error: bookingError } = await adminSupabase
            .from('bookings')
            .select(`
                id,
                agent_id,
                status,
                customer_name,
                customer_phone,
                service_name,
                booking_source,
                price_fcfa,
                deposit_required,
                deposit_amount_fcfa,
                deposit_status,
                payment_method,
                transaction_id,
                provider_payment_url,
                payment_provider,
                payment_provider_version
            `)
            .eq('id', bookingId)
            .single()

        if (bookingError || !booking) {
            return errorResponse('Booking not found', 404)
        }

        const { data: agent, error: agentError } = await adminSupabase
            .from('agents')
            .select('user_id')
            .eq('id', booking.agent_id)
            .single()

        if (agentError || !agent || agent.user_id !== user.id) {
            return errorResponse('Forbidden', 403)
        }

        if (!booking.deposit_required) {
            return errorResponse('This booking does not require a deposit', 400)
        }

        if (booking.status === 'cancelled' || booking.status === 'completed') {
            return errorResponse('This booking is no longer payable in its current state', 400)
        }

        if (booking.payment_method !== 'online') {
            return errorResponse('This booking is not configured for online payment', 400)
        }

        if (booking.deposit_status === 'paid') {
            return errorResponse('Deposit already paid', 400)
        }

        if (booking.deposit_status !== 'pending') {
            return errorResponse('Booking deposit is not payable in its current state', 400)
        }

        const amount = Number(booking.deposit_amount_fcfa || 0)
        if (!Number.isFinite(amount) || amount <= 0) {
            return errorResponse('Invalid deposit amount', 400)
        }

        const paymentLabel = isFullBookingPayment(booking) ? 'Paiement reservation' : 'Acompte reservation'

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
        const transactionId = `BKG_${booking.id.substring(0, 8)}_${Date.now()}`
        const defaultProvider = await getDefaultPaymentProvider(adminSupabase)
        const paymentProvider = normalizePaymentProvider(booking.payment_provider || defaultProvider)

        if (booking.transaction_id && booking.provider_payment_url) {
            const existingPayment = await inspectExistingHostedPayment(
                paymentProvider,
                booking.transaction_id,
                { providerVersion: booking.payment_provider_version || null }
            )

            if (existingPayment.action === 'reuse') {
                return NextResponse.json({
                    success: true,
                    payment_url: booking.provider_payment_url,
                    transaction_id: booking.transaction_id,
                    provider: paymentProvider,
                })
            }

            if (existingPayment.action === 'accepted') {
                return errorResponse('Ce paiement a deja ete valide. Actualisez la reservation dans quelques secondes.', 409)
            }
        }

        const result = await initializeHostedPayment({
            provider: paymentProvider,
            amountFcfa: amount,
            currency: 'XOF',
            transactionId,
            description: `${paymentLabel} #${booking.id.substring(0, 8)}`,
            customerName: booking.customer_name || 'Client',
            customerPhone: booking.customer_phone || '',
            returnUrl: `${baseUrl}/payment/success?transaction_id=${transactionId}`,
            failedUrl: `${baseUrl}/payment/success?transaction_id=${transactionId}&payment=cancelled`,
            notifyUrl: `${baseUrl}/api/payments/${paymentProvider}/webhook`,
            metadata: {
                booking_id: booking.id,
                type: 'booking_deposit'
            },
            agentId: booking.agent_id
        })

        if (!result.success || !result.paymentUrl) {
            return NextResponse.json(
                { success: false, error: result.error || 'Erreur de paiement' },
                { status: 400 }
            )
        }

        const { error: updateError } = await adminSupabase
            .from('bookings')
            .update({
                transaction_id: transactionId,
                payment_provider: paymentProvider,
                provider_payment_url: result.paymentUrl,
                provider_transaction_id: result.providerTransactionId || null,
                provider_notify_token: result.providerNotifyToken || null,
                payment_provider_version: result.providerVersion || 'v1',
                updated_at: new Date().toISOString()
            })
            .eq('id', booking.id)

        if (updateError) {
            throw updateError
        }

        return NextResponse.json({
            success: true,
            payment_url: result.paymentUrl,
            transaction_id: transactionId,
            provider: paymentProvider
        })
    } catch (err: unknown) {
        console.error('Booking payment initiation error:', err)
        const message = err instanceof Error ? err.message : 'Erreur lors de l initiation booking'
        return errorResponse(message, 500)
    }
}
