import { NextRequest } from 'next/server'
import { withAdminAuth, createAdminClient, successResponse, errorResponse } from '@/lib/api-utils'

// GET /api/admin/knowledge?mode=docs — Liste plate de tous les documents
// GET /api/admin/knowledge — Liste utilisateurs avec agents et comptes KB (legacy)
export const GET = withAdminAuth(async (request: NextRequest) => {
    const admin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')

    // Récupérer tous les agents (nécessaire dans les deux modes)
    const { data: agents, error: agentsError } = await admin
        .from('agents')
        .select('id, name, user_id')
        .order('created_at', { ascending: false })

    if (agentsError) return errorResponse('Erreur chargement agents', 500)
    if (!agents || agents.length === 0) {
        return successResponse(mode === 'docs' ? { documents: [], agents: [] } : { users: [] })
    }

    const userIds = [...new Set(agents.map(a => a.user_id))]
    const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

    const profileMap: Record<string, { full_name?: string; email?: string }> = {}
    for (const p of profiles || []) profileMap[p.id] = p

    const agentIds = agents.map(a => a.id)

    if (mode === 'docs') {
        // Liste plate de tous les documents (chunk_index = 0)
        const { data: docs, error: docsError } = await admin
            .from('knowledge_base')
            .select('id, source_id, title, agent_id, user_id, created_at, image_url')
            .in('agent_id', agentIds)
            .eq('chunk_index', 0)
            .order('created_at', { ascending: false })

        if (docsError) return errorResponse('Erreur chargement documents', 500)

        // Compter les chunks par source_id
        const sourceIds = (docs || []).map(d => d.source_id || d.id).filter(Boolean)
        let countBySource: Record<string, number> = {}
        if (sourceIds.length > 0) {
            const { data: chunkCounts } = await admin
                .from('knowledge_base')
                .select('source_id')
                .in('source_id', sourceIds)
            for (const row of chunkCounts || []) {
                if (row.source_id) countBySource[row.source_id] = (countBySource[row.source_id] || 0) + 1
            }
        }

        const agentMap: Record<string, { name: string; user_id: string }> = {}
        for (const a of agents) agentMap[a.id] = { name: a.name, user_id: a.user_id }

        const documents = (docs || []).map(doc => {
            const agent = agentMap[doc.agent_id] || {}
            const profile = profileMap[doc.user_id] || {}
            return {
                ...doc,
                chunks_count: countBySource[doc.source_id || doc.id] || 1,
                agent_name: agent.name || '—',
                owner_email: profile.email || '—',
                owner_name: profile.full_name || '—',
            }
        })

        const agentsList = agents.map(a => ({
            id: a.id,
            name: a.name,
            owner_email: profileMap[a.user_id]?.email || '—',
        }))

        return successResponse({ documents, agents: agentsList })
    }

    // Mode legacy : regrouper par utilisateur
    const { data: kbRows } = await admin
        .from('knowledge_base')
        .select('agent_id')
        .in('agent_id', agentIds)
        .eq('chunk_index', 0)

    const countByAgent: Record<string, number> = {}
    for (const row of kbRows || []) {
        if (row.agent_id) countByAgent[row.agent_id] = (countByAgent[row.agent_id] || 0) + 1
    }

    const usersMap: Record<string, {
        id: string; full_name?: string; email?: string
        agents: { id: string; name: string; kb_count: number }[]
    }> = {}

    for (const agent of agents) {
        if (!usersMap[agent.user_id]) {
            const profile = profileMap[agent.user_id] || {}
            usersMap[agent.user_id] = { id: agent.user_id, full_name: profile.full_name, email: profile.email, agents: [] }
        }
        usersMap[agent.user_id].agents.push({ id: agent.id, name: agent.name, kb_count: countByAgent[agent.id] || 0 })
    }

    return successResponse({ users: Object.values(usersMap) })
})
