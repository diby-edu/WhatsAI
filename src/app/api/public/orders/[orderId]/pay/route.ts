import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for public order lookup
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// CinetPay API configuration
const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY
const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID
const CINETPAY_BASE_URL = 'https://api-checkout.cinetpay.com/v2/payment'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params

    if (!CINETPAY_API_KEY || !CINETPAY_SITE_ID) {
        return NextResponse.json({ error: 'CinetPay non configuré' }, { status: 500 })
    }

    try {
        // Get order
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (error || !order) {
            return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
        }

        if (order.status === 'paid') {
            return NextResponse.json({ error: 'Commande déjà payée' }, { status: 400 })
        }

        // Generate unique transaction ID
        const transactionId = `ORD_${orderId.substring(0, 8)}_${Date.now()}`

        // Get app URL for callbacks
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://whatsai.duckdns.org'

        // Prepare CinetPay payload
        const payload = {
            apikey: CINETPAY_API_KEY,
            site_id: CINETPAY_SITE_ID,
            transaction_id: transactionId,
            amount: order.total_fcfa,
            currency: 'XOF',
            description: `Commande #${orderId.substring(0, 8)}`,
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
                type: 'order_payment'
            })
        }

        // Call CinetPay API
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
            // Update order with transaction ID
            await supabase.from('orders').update({
                transaction_id: transactionId
            }).eq('id', orderId)

            return NextResponse.json({
                success: true,
                payment_url: result.data.payment_url,
                transaction_id: transactionId
            })
        } else {
            return NextResponse.json({
                error: result.message || 'Erreur CinetPay',
                details: result
            }, { status: 400 })
        }
    } catch (err: any) {
        console.error('CinetPay initiation error:', err)
        return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
    }
}
