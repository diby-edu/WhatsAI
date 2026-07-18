import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

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
