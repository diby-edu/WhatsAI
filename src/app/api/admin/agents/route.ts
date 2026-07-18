import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

// GET /api/admin/agents - Get all agents (Admin only)
export async function GET(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

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
