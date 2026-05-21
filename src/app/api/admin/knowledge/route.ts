import { NextRequest } from 'next/server'
import { withAdminAuth, createAdminClient, successResponse, errorResponse } from '@/lib/api-utils'

// GET /api/admin/knowledge — Liste tous les utilisateurs avec leurs agents et comptes KB
export const GET = withAdminAuth(async (request: NextRequest) => {
    const admin = createAdminClient()

    // Récupérer tous les agents avec leur user_id et nom
    const { data: agents, error: agentsError } = await admin
        .from('agents')
        .select('id, name, user_id')
        .order('created_at', { ascending: false })

    if (agentsError) {
        return errorResponse('Erreur chargement agents', 500)
    }

    if (!agents || agents.length === 0) {
        return successResponse({ users: [] })
    }

    // Récupérer les profils des utilisateurs concernés
    const userIds = [...new Set(agents.map(a => a.user_id))]
    const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds)

    const profileMap: Record<string, { full_name?: string; email?: string; avatar_url?: string }> = {}
    for (const p of profiles || []) {
        profileMap[p.id] = p
    }

    // Récupérer le nombre de documents (chunk_index = 0) par agent
    const agentIds = agents.map(a => a.id)
    const { data: kbRows } = await admin
        .from('knowledge_base')
        .select('agent_id')
        .in('agent_id', agentIds)
        .eq('chunk_index', 0)

    const countByAgent: Record<string, number> = {}
    for (const row of kbRows || []) {
        if (row.agent_id) {
            countByAgent[row.agent_id] = (countByAgent[row.agent_id] || 0) + 1
        }
    }

    // Regrouper par utilisateur
    const usersMap: Record<string, {
        id: string
        full_name?: string
        email?: string
        avatar_url?: string
        agents: { id: string; name: string; kb_count: number }[]
    }> = {}

    for (const agent of agents) {
        if (!usersMap[agent.user_id]) {
            const profile = profileMap[agent.user_id] || {}
            usersMap[agent.user_id] = {
                id: agent.user_id,
                full_name: profile.full_name,
                email: profile.email,
                avatar_url: profile.avatar_url,
                agents: []
            }
        }
        usersMap[agent.user_id].agents.push({
            id: agent.id,
            name: agent.name,
            kb_count: countByAgent[agent.id] || 0
        })
    }

    const users = Object.values(usersMap)
    return successResponse({ users })
})
