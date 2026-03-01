import { NextRequest } from 'next/server'
import {
    createApiClient,
    createAdminClient,
    getAuthUser,
    errorResponse,
    successResponse,
    logAdminAction,
    isAdminRole,
} from '@/lib/api-utils'

async function cleanupAgentDependencies(adminSupabase: ReturnType<typeof createAdminClient>, agentId: string) {
    const { error: outboundError } = await adminSupabase
        .from('outbound_messages')
        .delete()
        .eq('agent_id', agentId)

    if (outboundError && outboundError.code !== '42P01') {
        throw outboundError
    }

    const { error: bySessionIdError } = await adminSupabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', agentId)

    if (!bySessionIdError) return

    if (bySessionIdError.code === '42703') {
        const { error: byAgentIdError } = await adminSupabase
            .from('whatsapp_sessions')
            .delete()
            .eq('agent_id', agentId)

        if (byAgentIdError && byAgentIdError.code !== '42P01' && byAgentIdError.code !== '42703') {
            throw byAgentIdError
        }
        return
    }

    if (bySessionIdError.code !== '42P01') {
        throw bySessionIdError
    }
}

async function requireAdminUser() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return { user: null, adminSupabase: null, response: errorResponse('Non autorise', 401) }
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!isAdminRole(profile?.role)) {
        return { user: null, adminSupabase: null, response: errorResponse('Acces refuse', 403) }
    }

    return { user, adminSupabase, response: null }
}

// PATCH /api/admin/agents/[id] - Toggle, update agent
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireAdminUser()
    if (guard.response || !guard.user || !guard.adminSupabase) {
        return guard.response!
    }

    const { user, adminSupabase } = guard

    try {
        const { id } = await params
        const body = await request.json()
        const { action, ...updateData } = body

        if (action === 'toggle') {
            const { data: agent } = await adminSupabase
                .from('agents')
                .select('is_active')
                .eq('id', id)
                .single()

            if (!agent) return errorResponse('Agent non trouve', 404)

            const { error } = await adminSupabase
                .from('agents')
                .update({ is_active: !agent.is_active })
                .eq('id', id)

            if (error) throw error

            await logAdminAction(user.id, 'toggle_agent', id, 'agent', { is_active: !agent.is_active })
            return successResponse({ message: `Agent ${agent.is_active ? 'desactive' : 'active'}`, is_active: !agent.is_active })
        }

        const allowedFields = ['name', 'system_prompt', 'model', 'temperature', 'is_active']
        const cleanUpdate: Record<string, any> = {}
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                cleanUpdate[key] = updateData[key]
            }
        }

        if (Object.keys(cleanUpdate).length === 0) {
            return errorResponse('Aucun champ a mettre a jour', 400)
        }

        const { error } = await adminSupabase
            .from('agents')
            .update(cleanUpdate)
            .eq('id', id)

        if (error) throw error

        await logAdminAction(user.id, 'update_agent', id, 'agent', cleanUpdate)

        return successResponse({ message: 'Agent mis a jour' })
    } catch (err) {
        console.error('Update agent error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// DELETE /api/admin/agents/[id] - Delete agent
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const guard = await requireAdminUser()
    if (guard.response || !guard.user || !guard.adminSupabase) {
        return guard.response!
    }

    const { user, adminSupabase } = guard

    try {
        const { id } = await params

        await cleanupAgentDependencies(adminSupabase, id)

        const { error } = await adminSupabase
            .from('agents')
            .delete()
            .eq('id', id)

        if (error) throw error

        await logAdminAction(user.id, 'delete_agent', id, 'agent')

        return successResponse({ message: 'Agent supprime' })
    } catch (err) {
        console.error('Delete agent error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
