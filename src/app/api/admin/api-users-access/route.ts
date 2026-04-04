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

// GET — liste des utilisateurs avec leur statut d'accès API
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminSupabase = createAdminClient()
    if (!(await verifyAdmin(adminSupabase, user.id))) return errorResponse('Accès refusé', 403)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const accessFilter = searchParams.get('access') // 'enabled' | 'disabled'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    try {
        let query = adminSupabase
            .from('profiles')
            .select('id, full_name, email, phone, plan, api_access_enabled, created_at', { count: 'exact' })
            .not('role', 'in', '("admin","superadmin")')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
        if (accessFilter === 'enabled') query = query.eq('api_access_enabled', true)
        if (accessFilter === 'disabled') query = query.eq('api_access_enabled', false)

        const { data: users, error, count } = await query

        if (error) throw error

        return successResponse({ data: users || [], total: count || 0 })
    } catch (err) {
        console.error('Admin api-users-access GET error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// PATCH — activer / désactiver l'accès API pour un ou plusieurs utilisateurs
export async function PATCH(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminSupabase = createAdminClient()
    if (!(await verifyAdmin(adminSupabase, user.id))) return errorResponse('Accès refusé', 403)

    const body = await request.json()
    const { user_id, user_ids, api_access_enabled } = body

    if (typeof api_access_enabled !== 'boolean') {
        return errorResponse('api_access_enabled (boolean) est requis', 422)
    }

    try {
        if (user_ids && Array.isArray(user_ids)) {
            // Mise à jour en masse
            const { error } = await adminSupabase
                .from('profiles')
                .update({ api_access_enabled })
                .in('id', user_ids)

            if (error) throw error
            return successResponse({
                updated: user_ids.length,
                api_access_enabled
            })
        }

        if (user_id) {
            // Mise à jour individuelle
            const { data, error } = await adminSupabase
                .from('profiles')
                .update({ api_access_enabled })
                .eq('id', user_id)
                .select('id, full_name, email, api_access_enabled')
                .single()

            if (error) throw error
            return successResponse({ data })
        }

        return errorResponse('user_id ou user_ids requis', 422)
    } catch (err) {
        console.error('Admin api-users-access PATCH error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
