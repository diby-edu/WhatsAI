import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

// GET - Preview recipient count for a broadcast
export async function GET(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { searchParams } = new URL(request.url)
        const recipientType = searchParams.get('recipientType') || 'agent_conversations'
        const agentId = searchParams.get('agentId')

        if (recipientType === 'escalation_phones') {
            const { data: agents, error } = await adminSupabase
                .from('agents')
                .select('escalation_phone')
                .not('escalation_phone', 'is', null)

            if (error) throw error

            const uniquePhones = [...new Set(agents?.map(a => a.escalation_phone).filter(Boolean) || [])]
            return successResponse({ count: uniquePhones.length })
        }

        // Mode par défaut : conversations de l'agent
        if (!agentId) {
            return errorResponse('agentId is required', 400)
        }

        const { data: conversations, error } = await adminSupabase
            .from('conversations')
            .select('contact_phone')
            .eq('agent_id', agentId)

        if (error) throw error

        const uniquePhones = [...new Set(conversations?.map(c => c.contact_phone) || [])]
        return successResponse({ count: uniquePhones.length })
    } catch (err) {
        console.error('Broadcast preview error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
