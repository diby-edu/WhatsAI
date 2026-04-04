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

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminSupabase = createAdminClient()
    if (!(await verifyAdmin(adminSupabase, user.id))) return errorResponse('Accès refusé', 403)

    const { searchParams } = new URL(request.url)
    const userId   = searchParams.get('user_id')
    const keyId    = searchParams.get('key_id')
    const status   = searchParams.get('status') // 'success' | 'error'
    const limit    = Math.min(parseInt(searchParams.get('limit') || '100'), 500)
    const offset   = parseInt(searchParams.get('offset') || '0')

    try {
        let query = adminSupabase
            .from('api_usage_logs')
            .select('id, user_id, api_key_id, agent_id, endpoint, method, status_code, response_ms, ip_address, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (userId) query = query.eq('user_id', userId)
        if (keyId) query = query.eq('api_key_id', keyId)
        if (status === 'error') query = query.gte('status_code', 400)
        if (status === 'success') query = query.lt('status_code', 400)

        const { data: logs, error, count } = await query

        if (error) throw error

        return successResponse({ data: logs || [], total: count || 0 })
    } catch (err) {
        console.error('Admin api-logs error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
