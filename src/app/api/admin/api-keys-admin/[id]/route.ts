import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

async function verifyAdmin(adminSupabase: any, userId: string) {
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
    return profile?.role === 'admin' || profile?.role === 'superadmin'
}

// PATCH — activer / désactiver une clé (révocation admin)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminSupabase = createAdminClient()
    if (!(await verifyAdmin(adminSupabase, user.id))) return errorResponse('Accès refusé', 403)

    const { id } = await params
    const body = await request.json()

    try {
        const { data, error } = await adminSupabase
            .from('api_keys')
            .update({ is_active: body.is_active })
            .eq('id', id)
            .select('id, name, is_active, user_id')
            .single()

        if (error) throw error
        return successResponse({ data })
    } catch (err) {
        console.error('Admin api-keys PATCH error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
