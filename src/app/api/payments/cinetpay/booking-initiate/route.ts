import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, errorResponse, getAuthUser } from '@/lib/api-utils'
import { initializePayment } from '@/lib/payments/cinetpay'
import { initializePaymentV2, shouldUseCinetPayV2ForAgent } from '@/lib/payments/cinetpay-v2'

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
                deposit_required,
                deposit_amount_fcfa,
                deposit_status,
                payment_method,
                transaction_id,
                provider_payment_url
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

        if (booking.transaction_id && booking.provider_payment_url) {
            return NextResponse.json({
                success: true,
                payment_url: booking.provider_payment_url,
                transaction_id: booking.transaction_id
            })
        }

        const amount = Number(booking.deposit_amount_fcfa || 0)
        if (!Number.isFinite(amount) || amount <= 0) {
            return errorResponse('Invalid deposit amount', 400)
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
        const transactionId = `BKG_${booking.id.substring(0, 8)}_${Date.now()}`
        const useCinetPayV2 = shouldUseCinetPayV2ForAgent(booking.agent_id)

        const result = useCinetPayV2
            ? await initializePaymentV2({
                amount,
                currency: 'XOF',
                merchantTransactionId: transactionId,
                designation: `Acompte reservation #${booking.id.substring(0, 8)}`,
                clientFullName: booking.customer_name || 'Client',
                clientPhoneNumber: booking.customer_phone || '',
                successUrl: `${baseUrl}/payment/success?transaction_id=${transactionId}`,
                failedUrl: `${baseUrl}/payment/success?transaction_id=${transactionId}&payment=cancelled`,
                notifyUrl: `${baseUrl}/api/payments/cinetpay/webhook`,
            })
            : await initializePayment({
                amount,
                currency: 'XOF',
                transactionId,
                description: `Acompte reservation #${booking.id.substring(0, 8)}`,
                customerName: booking.customer_name || 'Client',
                customerEmail: '',
                customerPhone: booking.customer_phone || '',
                returnUrl: `${baseUrl}/payment/success?transaction_id=${transactionId}`,
                notifyUrl: `${baseUrl}/api/payments/cinetpay/webhook`,
                metadata: {
                    booking_id: booking.id,
                    type: 'booking_deposit'
                }
            })

        if (!result.success || !result.paymentUrl) {
            return NextResponse.json(
                { success: false, error: result.error || 'Erreur CinetPay' },
                { status: 400 }
            )
        }

        const providerTransactionId = useCinetPayV2 && 'providerTransactionId' in result
            ? (result.providerTransactionId || null)
            : null
        const providerNotifyToken = useCinetPayV2 && 'notifyToken' in result
            ? (result.notifyToken || null)
            : null

        const { error: updateError } = await adminSupabase
            .from('bookings')
            .update({
                transaction_id: transactionId,
                provider_payment_url: result.paymentUrl,
                provider_transaction_id: providerTransactionId,
                provider_notify_token: providerNotifyToken,
                payment_provider_version: useCinetPayV2 ? 'v2' : 'v1',
                updated_at: new Date().toISOString()
            })
            .eq('id', booking.id)

        if (updateError) {
            throw updateError
        }

        return NextResponse.json({
            success: true,
            payment_url: result.paymentUrl,
            transaction_id: transactionId
        })
    } catch (err: unknown) {
        console.error('Booking CinetPay initiation error:', err)
        const message = err instanceof Error ? err.message : 'Erreur lors de l initiation booking'
        return errorResponse(message, 500)
    }
}
