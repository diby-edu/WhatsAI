import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// PATCH /api/admin/agents/[id] — Toggle, update agent
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { id } = await params
        const body = await request.json()
        const { action, ...updateData } = body

        if (action === 'toggle') {
            // Get current state
            const { data: agent } = await adminSupabase
                .from('agents')
                .select('is_active')
                .eq('id', id)
                .single()

            if (!agent) return errorResponse('Agent non trouvé', 404)

            const { error } = await adminSupabase
                .from('agents')
                .update({ is_active: !agent.is_active })
                .eq('id', id)

            if (error) throw error
            return successResponse({ message: `Agent ${agent.is_active ? 'désactivé' : 'activé'}`, is_active: !agent.is_active })
        }

        // Generic update
        const allowedFields = ['name', 'system_prompt', 'model', 'temperature', 'is_active']
        const cleanUpdate: Record<string, any> = {}
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                cleanUpdate[key] = updateData[key]
            }
        }

        if (Object.keys(cleanUpdate).length === 0) {
            return errorResponse('Aucun champ à mettre à jour', 400)
        }

        const { error } = await adminSupabase
            .from('agents')
            .update(cleanUpdate)
            .eq('id', id)

        if (error) throw error

        return successResponse({ message: 'Agent mis à jour' })
    } catch (err) {
        console.error('Update agent error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// DELETE /api/admin/agents/[id] — Delete agent
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { id } = await params

        const { error } = await adminSupabase
            .from('agents')
            .delete()
            .eq('id', id)

        if (error) throw error

        return successResponse({ message: 'Agent supprimé' })
    } catch (err) {
        console.error('Delete agent error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
