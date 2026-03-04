import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for public order lookup
// Use service role key for public order lookup
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
            .select('id, status, total_fcfa, delivery_address, customer_phone, payment_method')
            .eq('id', orderId)
            .single()

        if (error || !order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        const { data: items } = await getSupabase()
            .from('order_items')
            .select('product_name, quantity, unit_price_fcfa')
            .eq('order_id', orderId)

        return NextResponse.json({ order, items: items || [] })
    } catch (err) {
        console.error('Error fetching order:', err)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}

