import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH — activer/désactiver ou modifier l'URL/events
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const { id } = await params
    let body: any
    try { body = await request.json() } catch { return errorResponse('JSON invalide', 400) }

    // Vérifier ownership
    const { data: existing } = await supabaseAdmin
        .from('api_webhooks')
        .select('id, user_id')
        .eq('id', id)
        .single()

    if (!existing || existing.user_id !== user.id) {
        return errorResponse('Webhook introuvable', 404)
    }

    const updates: Record<string, any> = {}
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
    if (body.url) updates.url = body.url
    if (Array.isArray(body.events)) updates.events = body.events
    if (body.description !== undefined) updates.description = body.description

    if (Object.keys(updates).length === 0) return errorResponse('Aucun champ à modifier', 422)

    const { data, error } = await supabaseAdmin
        .from('api_webhooks')
        .update(updates)
        .eq('id', id)
        .select('id, url, events, is_active, description, created_at')
        .single()

    if (error) return errorResponse('Erreur serveur', 500)
    return successResponse({ data })
}

// DELETE — supprimer un webhook
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const { id } = await params

    const { data: existing } = await supabaseAdmin
        .from('api_webhooks')
        .select('id, user_id')
        .eq('id', id)
        .single()

    if (!existing || existing.user_id !== user.id) {
        return errorResponse('Webhook introuvable', 404)
    }

    const { error } = await supabaseAdmin
        .from('api_webhooks')
        .delete()
        .eq('id', id)

    if (error) return errorResponse('Erreur serveur', 500)
    return successResponse({ deleted: true })
}
