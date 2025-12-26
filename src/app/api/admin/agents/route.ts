import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/admin/agents - Get all agents (Admin only)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    if (user.user_metadata?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    const adminSupabase = createAdminClient()

    try {
        // Try to fetch with profile info
        // Note: This requires a foreign key relationship between agents.user_id and profiles.id
        const { data: agents, error } = await adminSupabase
            .from('agents')
            .select(`
                *,
                profiles:user_id (
                    full_name,
                    email
                )
            `)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('Could not fetch agent profiles relation, falling back to simple fetch:', error.message)
            // Fallback: Fetch agents without profile relation
            const { data: simpleAgents, error: simpleError } = await adminSupabase
                .from('agents')
                .select('*')
                .order('created_at', { ascending: false })

            if (simpleError) {
                console.error('Error fetching admin agents:', simpleError)
                return errorResponse('Erreur DB', 500)
            }
            return successResponse({ agents: simpleAgents })
        }

        return successResponse({ agents })
    } catch (err) {
        console.error('Admin agents API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
