import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET - List all products for user
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        return successResponse({ products })
    } catch (err) {
        console.error('Error fetching products:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST - Create new product
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const body = await request.json()

        const { data: product, error } = await supabase
            .from('products')
            .insert({
                user_id: user.id,
                agent_id: body.agent_id || null,
                product_type: body.product_type || 'product',
                name: body.name,
                description: body.description,
                ai_instructions: body.ai_instructions || null,
                price_fcfa: body.price_fcfa || 0,
                category: body.category,
                sku: body.sku,
                image_url: body.image_url || (body.images?.[0] || null),
                images: body.images || [],
                is_available: body.is_available ?? true,
                stock_quantity: body.stock_quantity ?? -1,
                lead_fields: body.lead_fields || []
            })
            .select()
            .single()

        if (error) throw error

        return successResponse({ product }, 201)
    } catch (err) {
        console.error('Error creating product:', err)
        return errorResponse('Erreur lors de la création', 500)
    }
}
