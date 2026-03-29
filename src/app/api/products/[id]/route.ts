import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

function normalizeRestaurantMenuFields(body: any) {
    const isRestaurantService = body.product_type === 'service' && body.service_subtype === 'restaurant'
    const rawSortOrder = body.menu_sort_order
    const parsedSortOrder =
        rawSortOrder === '' || rawSortOrder === null || rawSortOrder === undefined
            ? null
            : Number(rawSortOrder)

    return {
        menu_section_slug: isRestaurantService ? (body.menu_section_slug || null) : null,
        menu_sort_order:
            isRestaurantService && Number.isFinite(parsedSortOrder)
                ? parsedSortOrder
                : null
    }
}

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
        const restaurantMenuFields = normalizeRestaurantMenuFields(body)

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
                product_type: body.product_type || 'product',
                variants: body.variants,
                combinations: body.combinations ?? null,
                images: body.images,
                // New structured fields
                short_pitch: body.short_pitch,
                features: body.features,
                marketing_tags: body.marketing_tags,
                related_product_ids: body.related_product_ids,
                service_subtype: body.service_subtype || null,
                ...restaurantMenuFields,
                digital_content: body.digital_content ?? null,
                license_keys: body.license_keys !== undefined ? body.license_keys : undefined
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) throw error

        return successResponse({ product })
    } catch (err: any) {
        console.error('Error updating product:', err)
        const detail = err?.message || err?.details || err?.hint || JSON.stringify(err)
        return errorResponse(`Erreur lors de la mise à jour: ${detail}`, 500)
    }
}

// DELETE - Delete product (with image cleanup)
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
        // 1. First, fetch the product to get its image_url
        const { data: product } = await supabase
            .from('products')
            .select('image_url')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        // 2. If product has an image, delete it from Storage
        if (product?.image_url) {
            try {
                // Extract filename from URL
                // URL format: https://xxx.supabase.co/storage/v1/object/public/images/products/filename.ext
                const url = new URL(product.image_url)
                const pathParts = url.pathname.split('/images/')
                if (pathParts.length > 1) {
                    const filePath = pathParts[1] // e.g., "products/1234567.webp"
                    console.log('🗑️ Deleting image from storage:', filePath)

                    const { error: storageError } = await supabase.storage
                        .from('images')
                        .remove([filePath])

                    if (storageError) {
                        console.error('⚠️ Failed to delete image:', storageError)
                        // Continue with product deletion even if image cleanup fails
                    } else {
                        console.log('✅ Image deleted from storage')
                    }
                }
            } catch (urlError) {
                console.error('⚠️ Error parsing image URL:', urlError)
                // Continue with product deletion
            }
        }

        // 3. Delete the product from database
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) throw error

        return successResponse({ message: 'Produit et image supprimés' })
    } catch (err) {
        console.error('Error deleting product:', err)
        return errorResponse('Erreur lors de la suppression', 500)
    }
}
