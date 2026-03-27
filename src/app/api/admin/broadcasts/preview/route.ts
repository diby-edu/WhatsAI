import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// GET - Preview recipient count for a broadcast
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Forbidden - Admin only', 403)
    }

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
