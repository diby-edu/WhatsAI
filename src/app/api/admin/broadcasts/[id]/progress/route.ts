import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) return errorResponse('Unauthorized', 401)

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Forbidden', 403)
    }

    try {
        const { data: rows, error } = await adminSupabase
            .from('outbound_messages')
            .select('status')
            .eq('broadcast_id', id)

        if (error) throw error

        const total = rows?.length || 0
        const sent = rows?.filter(r => r.status === 'sent').length || 0
        const failed = rows?.filter(r => r.status === 'failed').length || 0
        const pending = rows?.filter(r => r.status === 'pending').length || 0

        return successResponse({ total, sent, failed, pending })
    } catch (err) {
        console.error('Broadcast progress error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
