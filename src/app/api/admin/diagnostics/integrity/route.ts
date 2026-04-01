import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { buildIntegrityDiagnostics } from '@/lib/admin/integrity'

export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)

        const [
            usersResult,
            agentsResult,
            conversationsResult,
            paymentsResult,
            messagesResult,
            profilesDataResult,
            agentsDataResult,
            conversationsDataResult,
            messagesDataResult,
            stuckPaymentsResult,
            negativeCreditsResult,
        ] = await Promise.all([
            adminSupabase.from('profiles').select('*', { count: 'exact', head: true }),
            adminSupabase.from('agents').select('*', { count: 'exact', head: true }),
            adminSupabase.from('conversations').select('*', { count: 'exact', head: true }),
            adminSupabase.from('payments').select('*', { count: 'exact', head: true }),
            adminSupabase.from('messages').select('*', { count: 'exact', head: true }),
            adminSupabase.from('profiles').select('id'),
            adminSupabase.from('agents').select('id, user_id, is_active, archived_at'),
            adminSupabase.from('conversations').select('id, agent_id'),
            adminSupabase.from('messages').select('id, conversation_id, agent_id'),
            adminSupabase
                .from('payments')
                .select('id')
                .eq('status', 'pending')
                .lt('created_at', weekAgo.toISOString()),
            adminSupabase
                .from('profiles')
                .select('id')
                .lt('credits_balance', 0),
        ])

        const blockingError = [
            usersResult.error,
            agentsResult.error,
            conversationsResult.error,
            paymentsResult.error,
            messagesResult.error,
            profilesDataResult.error,
            agentsDataResult.error,
            conversationsDataResult.error,
            messagesDataResult.error,
            stuckPaymentsResult.error,
            negativeCreditsResult.error,
        ].find(Boolean)

        if (blockingError) {
            throw blockingError
        }

        const profiles = profilesDataResult.data || []
        const agents = agentsDataResult.data || []
        const conversations = conversationsDataResult.data || []
        const messages = messagesDataResult.data || []

        const profileIds = new Set(profiles.map((profile) => profile.id))
        const agentIds = new Set(agents.map((agent) => agent.id))
        const conversationIds = new Set(conversations.map((conversation) => conversation.id))
        const overdueArchiveCutoffMs = Date.now() - (7 * 24 * 60 * 60 * 1000)

        const results = buildIntegrityDiagnostics({
            totalUsers: usersResult.count || 0,
            totalAgents: agentsResult.count || 0,
            totalConversations: conversationsResult.count || 0,
            totalPayments: paymentsResult.count || 0,
            totalMessages: messagesResult.count || 0,
            orphanedAgentsNoUserId: agents.filter((agent) => !agent.user_id).length,
            agentsWithoutProfile: agents.filter((agent) => agent.user_id && !profileIds.has(agent.user_id)).length,
            conversationsWithoutAgentId: conversations.filter((conversation) => !conversation.agent_id).length,
            conversationsMissingAgent: conversations.filter((conversation) => conversation.agent_id && !agentIds.has(conversation.agent_id)).length,
            messagesWithoutConversationId: messages.filter((message) => !message.conversation_id).length,
            messagesMissingConversation: messages.filter((message) => message.conversation_id && !conversationIds.has(message.conversation_id)).length,
            messagesMissingAgent: messages.filter((message) => message.agent_id && !agentIds.has(message.agent_id)).length,
            stuckPayments: stuckPaymentsResult.data?.length || 0,
            negativeCredits: negativeCreditsResult.data?.length || 0,
            archivedAgents: agents.filter((agent) => !!agent.archived_at).length,
            overdueArchivedAgents: agents.filter((agent) => agent.archived_at && new Date(agent.archived_at).getTime() <= overdueArchiveCutoffMs).length,
            archivedActiveAgents: agents.filter((agent) => agent.archived_at && agent.is_active !== false).length,
        })

        return successResponse(results)
    } catch (err: any) {
        console.error('Data integrity check error:', err)
        return successResponse({
            tables: [],
            issues: [{
                type: 'anomaly',
                table: 'diagnostics',
                count: 1,
                message: err.message || 'Erreur lors de la verification',
            }],
            stats: {
                totalUsers: 0,
                totalAgents: 0,
                totalConversations: 0,
                totalPayments: 0,
                totalMessages: 0,
                orphanedRecords: 0,
                archivedAgents: 0,
            },
            overallStatus: 'error',
        })
    }
}
