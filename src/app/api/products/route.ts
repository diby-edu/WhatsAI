import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { getManualProductsBlockedReason } from '@/lib/agents/ecommerce-mode'

const CreateProductSchema = z.object({
    name: z.string().min(1, 'Le nom du produit est requis').max(200),
    price_fcfa: z.number().min(0, 'Le prix ne peut pas être négatif').optional(),
    product_type: z.enum(['product', 'service', 'booking', 'digital', 'virtual']).optional(),
})

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

function normalizeServiceSubtype(body: any) {
    return body.product_type === 'service' ? (body.service_subtype || null) : null
}

// Garde-fou serveur : un produit physique n'a jamais de variante "additive" (supplément
// optionnel) — toute variante est obligatoire. Force type="fixed" quelle que soit la
// source (saisie manuelle, extraction IA, requête API directe).
function sanitizeVariantsForProductType(body: any): any[] {
    const variants = Array.isArray(body.variants) ? body.variants : []
    // Même valeur par défaut que le champ product_type effectivement stocké ci-dessous.
    if ((body.product_type || 'product') !== 'product') return variants
    return variants.map((v: any) => ({ ...v, type: 'fixed' }))
}

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

        const parsed = CreateProductSchema.safeParse(body)
        if (!parsed.success) {
            return errorResponse('Données invalides : ' + parsed.error.issues.map(e => e.message).join(', '), 400)
        }

        const restaurantMenuFields = normalizeRestaurantMenuFields(body)

        // Un produit doit toujours etre rattache a un agent — c'est la mission de
        // cet agent qui determine le type de produit (Physique/Numerique/Restaurant/Hotel).
        if (!body.agent_id) {
            return errorResponse('Agent vendeur requis', 400)
        }

        // v2.19: Mandatory service_subtype validation
        if (body.product_type === 'service' && !body.service_subtype) {
            return errorResponse('CatÃ©gorie de service obligatoire', 400)
        }

        // Bloquer l'ajout de produit sur un agent Support Client ou external_sync
        const { data: agentCheck } = await supabase
            .from('agents')
            .select('mission, ecommerce_mode')
            .eq('id', body.agent_id)
            .eq('user_id', user.id)
            .single()

        const blockedReason = getManualProductsBlockedReason(agentCheck)
        if (blockedReason) {
            return errorResponse(blockedReason, 400)
        }

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
                lead_fields: body.lead_fields || [],
                variants: sanitizeVariantsForProductType(body),
                combinations: body.combinations ?? null,
                // New structured fields
                short_pitch: body.short_pitch || null,
                features: body.features || [],
                marketing_tags: body.marketing_tags || [],
                related_product_ids: body.related_product_ids || [],
                service_subtype: normalizeServiceSubtype(body),
                ...restaurantMenuFields,
                digital_content: body.digital_content || null,
                license_keys: body.license_keys || null
            })
            .select()
            .single()

        if (error) throw error

        return successResponse({ product }, 201)
    } catch (err) {
        console.error('Error creating product:', err)
        return errorResponse('Erreur lors de la crÃ©ation', 500)
    }
}
