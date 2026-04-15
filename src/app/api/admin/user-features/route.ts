import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

async function checkAdmin(supabase: any, adminSupabase: any, user: any) {
    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    return profile?.role === 'admin' || profile?.role === 'superadmin'
}

// GET /api/admin/user-features?user_id=xxx  — flags d'un utilisateur
// GET /api/admin/user-features               — tous les overrides (liste admin)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const adminSupabase = createAdminClient()
    if (!(await checkAdmin(supabase, adminSupabase, user))) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    try {
        if (userId) {
            const { data, error } = await adminSupabase
                .from('user_feature_flags')
                .select('feature_key, enabled, created_at')
                .eq('user_id', userId)
            if (error) throw error
            return successResponse({ flags: data || [] })
        }

        // Liste tous les overrides avec infos utilisateur
        const { data, error } = await adminSupabase
            .from('user_feature_flags')
            .select('id, user_id, feature_key, enabled, created_at, profiles:user_id(full_name, email)')
            .order('created_at', { ascending: false })
        if (error) throw error
        return successResponse({ flags: data || [] })
    } catch (err) {
        console.error('user-features GET error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST /api/admin/user-features — upsert flags pour un utilisateur
// Body: { user_id, features: [{ key, enabled }] }
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const adminSupabase = createAdminClient()
    if (!(await checkAdmin(supabase, adminSupabase, user))) return errorResponse('Forbidden', 403)

    try {
        const body = await request.json()
        const { user_id, features } = body

        if (!user_id || !Array.isArray(features)) return errorResponse('user_id et features requis', 400)

        for (const f of features) {
            if (f.enabled === false) {
                // Supprimer l'override si on désactive (retour au flag global)
                await adminSupabase.from('user_feature_flags')
                    .delete()
                    .eq('user_id', user_id)
                    .eq('feature_key', f.key)
            } else {
                await adminSupabase.from('user_feature_flags').upsert({
                    user_id,
                    feature_key: f.key,
                    enabled: true,
                    granted_by: user.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,feature_key' })
            }
        }

        return successResponse({ message: 'Flags utilisateur mis à jour' })
    } catch (err) {
        console.error('user-features POST error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
