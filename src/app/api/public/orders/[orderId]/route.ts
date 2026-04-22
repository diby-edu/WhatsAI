import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDefaultPaymentProvider, resolveHostedPaymentProvider } from '@/lib/payments/provider'
import { getFeexPayDefaultNetwork } from '@/lib/payments/feexpay'
import {
    getFeexPayNetworkOption,
    inferFeexPayCountryFromPhone,
    listFeexPayCountries,
    normalizeFeexPayNetwork,
} from '@/lib/payments/feexpay-networks'

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params

    try {
        const { data: order, error } = await getSupabase()
            .from('orders')
            .select(`
                id,
                status,
                total_fcfa,
                delivery_address,
                customer_phone,
                payment_method,
                payment_provider,
                transaction_id,
                provider_transaction_id,
                provider_payment_url,
                fulfillment_mode,
                pickup_at,
                deposit_required,
                deposit_amount_fcfa,
                deposit_status
            `)
            .eq('id', orderId)
            .single()

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        const { data: items } = await getSupabase()
            .from('order_items')
            .select('product_name, quantity, unit_price_fcfa')
            .eq('order_id', orderId)

        const adminSupabase = getSupabase()
        const defaultProvider = await getDefaultPaymentProvider(adminSupabase)
        const resolvedProvider = resolveHostedPaymentProvider({
            defaultProvider,
            storedProvider: order.payment_provider,
            transactionId: order.transaction_id,
            providerPaymentUrl: order.provider_payment_url,
        })

        const responseOrder = {
            ...order,
            payment_provider: resolvedProvider,
        }

        const payload: Record<string, unknown> = {
            order: responseOrder,
            items: items || [],
        }

        if (resolvedProvider === 'feexpay') {
            const defaultNetwork = normalizeFeexPayNetwork(getFeexPayDefaultNetwork())
            const defaultNetworkOption = defaultNetwork ? getFeexPayNetworkOption(defaultNetwork) : null
            const inferredCountry = inferFeexPayCountryFromPhone(order.customer_phone)

            payload.feexpay = {
                countries: listFeexPayCountries(),
                default_country: defaultNetworkOption?.countryCode || inferredCountry || null,
                default_network: defaultNetworkOption?.code || null,
            }
        }

        return NextResponse.json(payload)
    } catch (err) {
        console.error('Error fetching order:', err)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
