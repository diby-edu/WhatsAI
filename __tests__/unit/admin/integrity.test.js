const { buildIntegrityDiagnostics } = require('../../../src/lib/admin/integrity')

describe('buildIntegrityDiagnostics', () => {
    test('returns ok when no integrity issue is found', () => {
        const result = buildIntegrityDiagnostics({
            totalUsers: 10,
            totalAgents: 4,
            totalConversations: 12,
            totalPayments: 8,
            totalMessages: 40,
            orphanedAgentsNoUserId: 0,
            agentsWithoutProfile: 0,
            conversationsWithoutAgentId: 0,
            conversationsMissingAgent: 0,
            messagesWithoutConversationId: 0,
            messagesMissingConversation: 0,
            messagesMissingAgent: 0,
            stuckPayments: 0,
            negativeCredits: 0,
            archivedAgents: 0,
            overdueArchivedAgents: 0,
            archivedActiveAgents: 0,
        })

        expect(result.overallStatus).toBe('ok')
        expect(result.issues).toHaveLength(0)
        expect(result.stats.orphanedRecords).toBe(0)
    })

    test('flags orphan references as warning', () => {
        const result = buildIntegrityDiagnostics({
            totalUsers: 10,
            totalAgents: 4,
            totalConversations: 12,
            totalPayments: 8,
            totalMessages: 40,
            orphanedAgentsNoUserId: 1,
            agentsWithoutProfile: 2,
            conversationsWithoutAgentId: 1,
            conversationsMissingAgent: 1,
            messagesWithoutConversationId: 1,
            messagesMissingConversation: 0,
            messagesMissingAgent: 0,
            stuckPayments: 0,
            negativeCredits: 0,
            archivedAgents: 0,
            overdueArchivedAgents: 0,
            archivedActiveAgents: 0,
        })

        expect(result.overallStatus).toBe('warning')
        expect(result.stats.orphanedRecords).toBe(6)
        expect(result.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
            '1 agents sans user_id',
            '2 agents rattachés à un profil introuvable',
            '1 conversations sans agent_id',
            '1 conversations pointent vers un agent inexistant',
            '1 messages sans conversation_id',
        ]))
    })

    test('escalates archived lifecycle anomalies to error', () => {
        const result = buildIntegrityDiagnostics({
            totalUsers: 10,
            totalAgents: 4,
            totalConversations: 12,
            totalPayments: 8,
            totalMessages: 40,
            orphanedAgentsNoUserId: 0,
            agentsWithoutProfile: 0,
            conversationsWithoutAgentId: 0,
            conversationsMissingAgent: 0,
            messagesWithoutConversationId: 0,
            messagesMissingConversation: 0,
            messagesMissingAgent: 0,
            stuckPayments: 1,
            negativeCredits: 1,
            archivedAgents: 2,
            overdueArchivedAgents: 1,
            archivedActiveAgents: 1,
        })

        expect(result.overallStatus).toBe('error')
        expect(result.stats.archivedAgents).toBe(2)
        expect(result.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
            '1 paiements en attente depuis > 7 jours',
            '1 utilisateurs avec credits negatifs',
            '1 agents archives restent marques actifs',
            '1 agents archives depuis > 7 jours sont encore presents',
        ]))
    })
})
