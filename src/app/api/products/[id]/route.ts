import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET - Get single product
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error || !product) {
            return errorResponse('Produit non trouvé', 404)
        }

        return successResponse({ product })
    } catch (err) {
        console.error('Error fetching product:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// PUT - Update product
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const body = await request.json()

        const { data: product, error } = await supabase
            .from('products')
            .update({
                name: body.name,
                description: body.description,
                price_fcfa: body.price_fcfa,
                category: body.category,
                sku: body.sku,
                image_url: body.image_url,
                is_available: body.is_available,
                stock_quantity: body.stock_quantity,
                agent_id: body.agent_id,
                variants: body.variants
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) throw error

        return successResponse({ product })
    } catch (err) {
        console.error('Error updating product:', err)
        return errorResponse('Erreur lors de la mise à jour', 500)
    }
}

// DELETE - Delete product
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) throw error

        return successResponse({ message: 'Produit supprimé' })
    } catch (err) {
        console.error('Error deleting product:', err)
        return errorResponse('Erreur lors de la suppression', 500)
    }
}
