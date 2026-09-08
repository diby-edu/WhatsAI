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

// GET — toutes les clés API (tous utilisateurs)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminSupabase = createAdminClient()
    if (!(await verifyAdmin(adminSupabase, user.id))) return errorResponse('Accès refusé', 403)

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    try {
        // Audit F-06 : api_keys.user_id référence auth.users (et non public.profiles),
        // donc l'embed PostgREST `profiles:user_id(...)` échouait systématiquement en
        // 500 — l'UI affichait alors "Aucune clé API" (faux état vide). On récupère
        // désormais les clés puis les profils séparément avant de fusionner.
        let query = adminSupabase
            .from('api_keys')
            .select(`
                id, name, key_prefix, environment, is_active,
                rate_limit_per_minute, allowed_agent_ids,
                last_used_at, created_at, expires_at, user_id
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (userId) query = query.eq('user_id', userId)
        if (search) query = query.ilike('name', `%${search}%`)

        const { data: keys, error, count } = await query

        if (error) throw error

        const rows = (keys || []) as any[]
        const userIds = [...new Set(rows.map((k) => k.user_id).filter(Boolean))]
        const profilesById: Record<string, { full_name: string | null; email: string | null }> = {}

        if (userIds.length > 0) {
            const { data: profs } = await adminSupabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds)
            for (const p of (profs || []) as any[]) {
                profilesById[p.id] = { full_name: p.full_name ?? null, email: p.email ?? null }
            }
        }

        const enriched = rows.map((k) => ({ ...k, profiles: profilesById[k.user_id] || null }))

        return successResponse({ data: enriched, total: count || 0 })
    } catch (err) {
        console.error('Admin api-keys error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
