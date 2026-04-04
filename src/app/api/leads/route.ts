import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/leads?agentId=xxx — liste les leads d'un agent
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const agentId = request.nextUrl.searchParams.get('agentId')
    if (!agentId) return errorResponse('agentId requis', 400)

    try {
        // Vérifier que l'agent appartient à l'utilisateur
        const { data: agent } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .eq('user_id', user.id)
            .single()

        if (!agent) return errorResponse('Agent introuvable', 404)

        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false })

        if (error) throw error

        return successResponse({ leads: leads || [] })
    } catch (err) {
        console.error('Error fetching leads:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// DELETE /api/leads?id=xxx — supprimer un lead
export async function DELETE(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const leadId = request.nextUrl.searchParams.get('id')
    if (!leadId) return errorResponse('id requis', 400)

    try {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', leadId)
            .eq('user_id', user.id)

        if (error) throw error

        return successResponse({ deleted: true })
    } catch (err) {
        console.error('Error deleting lead:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
