import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

function pickRelation<T>(relation: T | T[] | null | undefined): T | null {
    if (Array.isArray(relation)) {
        return relation[0] || null
    }

    return relation || null
}

export async function GET() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Verify admin role via DB (secure)
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { data: conversations, error } = await adminSupabase
            .from('conversations')
            .select(`
                id,
                agent_id,
                user_id,
                bot_paused,
                contact_phone,
                contact_push_name,
                last_message_text,
                last_message_at,
                created_at,
                updated_at,
                agent:agents(name),
                profile:profiles(full_name, email)
            `)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('Error fetching conversations:', error)
            return errorResponse(error.message, 500)
        }

        // Add message counts for each conversation.
        // IMPORTANT: use adminSupabase (bypasses RLS) — supabase client returns 0 due to RLS policies
        const conversationsWithCounts = await Promise.all(conversations.map(async (conv) => {
            const { count } = await adminSupabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conv.id)

            const agent = pickRelation(conv.agent)
            const profile = pickRelation(conv.profile)

            return {
                ...conv,
                agent,
                profile,
                messages_count: count || 0,
                last_message: conv.last_message_text || '',
                last_message_at: conv.last_message_at || conv.updated_at
            }
        }))

        const now = Date.now()
        const dayAgo = now - 24 * 60 * 60 * 1000

        const isActiveInLast24h = (value?: string | null) => {
            const timestamp = Date.parse(value || '')
            return Number.isFinite(timestamp) && timestamp >= dayAgo
        }

        const byAgentMap = new Map<string, {
            agentId: string | null
            agentName: string
            conversations: number
            messages: number
            paused: number
            activeLast24h: number
        }>()

        const byOwnerMap = new Map<string, {
            userId: string | null
            ownerName: string
            ownerEmail: string | null
            conversations: number
            messages: number
            paused: number
        }>()

        const pausedOver24h = conversationsWithCounts
            .filter((conv) => conv.bot_paused === true && !isActiveInLast24h(conv.last_message_at || conv.updated_at))
            .map((conv) => {
                const referenceTime = Date.parse(conv.last_message_at || conv.updated_at || conv.created_at || '')
                const hoursPaused = Number.isFinite(referenceTime)
                    ? Math.max(24, Math.floor((now - referenceTime) / (1000 * 60 * 60)))
                    : 24

                return {
                    id: conv.id,
                    contact_phone: conv.contact_phone,
                    contact_push_name: conv.contact_push_name || null,
                    agent_name: conv.agent?.name || 'Agent supprime',
                    last_message_at: conv.last_message_at || conv.updated_at,
                    hoursPaused,
                    messages_count: conv.messages_count || 0,
                }
            })
            .sort((a, b) => b.hoursPaused - a.hoursPaused)

        for (const conv of conversationsWithCounts) {
            const agentKey = conv.agent_id || 'unknown-agent'
            const ownerKey = conv.user_id || 'unknown-owner'
            const activeLast24h = isActiveInLast24h(conv.last_message_at || conv.updated_at) ? 1 : 0

            const currentAgent = byAgentMap.get(agentKey) || {
                agentId: conv.agent_id || null,
                agentName: conv.agent?.name || 'Agent supprime',
                conversations: 0,
                messages: 0,
                paused: 0,
                activeLast24h: 0,
            }
            currentAgent.conversations += 1
            currentAgent.messages += conv.messages_count || 0
            currentAgent.paused += conv.bot_paused === true ? 1 : 0
            currentAgent.activeLast24h += activeLast24h
            byAgentMap.set(agentKey, currentAgent)

            const currentOwner = byOwnerMap.get(ownerKey) || {
                userId: conv.user_id || null,
                ownerName: conv.profile?.full_name || conv.profile?.email || 'Proprietaire inconnu',
                ownerEmail: conv.profile?.email || null,
                conversations: 0,
                messages: 0,
                paused: 0,
            }
            currentOwner.conversations += 1
            currentOwner.messages += conv.messages_count || 0
            currentOwner.paused += conv.bot_paused === true ? 1 : 0
            byOwnerMap.set(ownerKey, currentOwner)
        }

        const byAgent = [...byAgentMap.values()].sort((a, b) => {
            if (b.conversations !== a.conversations) return b.conversations - a.conversations
            return b.messages - a.messages
        })

        const byOwner = [...byOwnerMap.values()].sort((a, b) => {
            if (b.conversations !== a.conversations) return b.conversations - a.conversations
            return b.messages - a.messages
        })

        const kpis = {
            totalConversations: conversationsWithCounts.length,
            totalMessages: conversationsWithCounts.reduce((sum, conv) => sum + (conv.messages_count || 0), 0),
            activeLast24h: conversationsWithCounts.filter((conv) => isActiveInLast24h(conv.last_message_at || conv.updated_at)).length,
            pausedConversations: conversationsWithCounts.filter((conv) => conv.bot_paused === true).length,
            pausedOver24h: pausedOver24h.length,
            uniqueAgents: new Set(conversationsWithCounts.map((conv) => conv.agent_id).filter(Boolean)).size,
            uniqueContacts: new Set(conversationsWithCounts.map((conv) => conv.contact_phone).filter(Boolean)).size,
        }

        return successResponse({
            conversations: conversationsWithCounts,
            kpis,
            breakdowns: {
                byAgent,
                byOwner,
                topAgentsByMessages: [...byAgent].sort((a, b) => b.messages - a.messages).slice(0, 5),
                pausedOver24h: pausedOver24h.slice(0, 8),
            }
        })
    } catch {
        return errorResponse('Erreur serveur', 500)
    }
}
