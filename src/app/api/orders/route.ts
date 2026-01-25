import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET - List all orders for user
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')

        let query = supabase
            .from('orders')
            *,
            items: order_items(
                    *,
                product: products(product_type)
                )
        `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        const { data: orders, error } = await query

        if (error) throw error

        return successResponse({ orders })
    } catch (err) {
        console.error('Error fetching orders:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST - Create new order
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const body = await request.json()

        // Calculate total from items
        let total = 0
        if (body.items && Array.isArray(body.items)) {
            total = body.items.reduce((sum: number, item: any) => {
                return sum + (item.unit_price_fcfa * item.quantity)
            }, 0)
        }

        // Create order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: user.id,
                agent_id: body.agent_id || null,
                conversation_id: body.conversation_id || null,
                customer_phone: body.customer_phone,
                customer_name: body.customer_name,
                status: 'pending',
                total_fcfa: total,
                delivery_address: body.delivery_address,
                delivery_notes: body.delivery_notes,
                notes: body.notes
            })
            .select()
            .single()

        if (orderError) throw orderError

        // Create order items
        if (body.items && body.items.length > 0) {
            const orderItems = body.items.map((item: any) => ({
                order_id: order.id,
                product_id: item.product_id || null,
                product_name: item.product_name,
                product_description: item.product_description,
                quantity: item.quantity,
                unit_price_fcfa: item.unit_price_fcfa
            }))

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems)

            if (itemsError) throw itemsError
        }

        return successResponse({ order }, 201)
    } catch (err) {
        console.error('Error creating order:', err)
        return errorResponse('Erreur lors de la création', 500)
    }
}
