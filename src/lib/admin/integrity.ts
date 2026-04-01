export type IntegrityIssue = {
    type: 'orphaned' | 'stuck' | 'anomaly'
    table: string
    count: number
    message: string
}

export type IntegrityDiagnosticsInput = {
    totalUsers: number
    totalAgents: number
    totalConversations: number
    totalPayments: number
    totalMessages: number
    orphanedAgentsNoUserId: number
    agentsWithoutProfile: number
    conversationsWithoutAgentId: number
    conversationsMissingAgent: number
    messagesWithoutConversationId: number
    messagesMissingConversation: number
    messagesMissingAgent: number
    stuckPayments: number
    negativeCredits: number
    archivedAgents: number
    overdueArchivedAgents: number
    archivedActiveAgents: number
}

export type IntegrityDiagnosticsResult = {
    tables: Array<{
        name: string
        count: number
        status: 'ok' | 'error'
    }>
    issues: IntegrityIssue[]
    stats: {
        totalUsers: number
        totalAgents: number
        totalConversations: number
        totalPayments: number
        totalMessages: number
        orphanedRecords: number
        archivedAgents: number
    }
    overallStatus: 'ok' | 'warning' | 'error'
}

function pushIssue(
    issues: IntegrityIssue[],
    stats: IntegrityDiagnosticsResult['stats'],
    issue: IntegrityIssue,
    options?: { orphaned?: boolean }
) {
    issues.push(issue)
    if (options?.orphaned) {
        stats.orphanedRecords += issue.count
    }
}

export function buildIntegrityDiagnostics(input: IntegrityDiagnosticsInput): IntegrityDiagnosticsResult {
    const result: IntegrityDiagnosticsResult = {
        tables: [
            { name: 'profiles', count: input.totalUsers, status: 'ok' },
            { name: 'agents', count: input.totalAgents, status: 'ok' },
            { name: 'conversations', count: input.totalConversations, status: 'ok' },
            { name: 'payments', count: input.totalPayments, status: 'ok' },
            { name: 'messages', count: input.totalMessages, status: 'ok' },
        ],
        issues: [],
        stats: {
            totalUsers: input.totalUsers,
            totalAgents: input.totalAgents,
            totalConversations: input.totalConversations,
            totalPayments: input.totalPayments,
            totalMessages: input.totalMessages,
            orphanedRecords: 0,
            archivedAgents: input.archivedAgents,
        },
        overallStatus: 'ok',
    }

    if (input.orphanedAgentsNoUserId > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'orphaned',
            table: 'agents',
            count: input.orphanedAgentsNoUserId,
            message: `${input.orphanedAgentsNoUserId} agents sans user_id`,
        }, { orphaned: true })
    }

    if (input.agentsWithoutProfile > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'orphaned',
            table: 'agents',
            count: input.agentsWithoutProfile,
            message: `${input.agentsWithoutProfile} agents rattachés à un profil introuvable`,
        }, { orphaned: true })
    }

    if (input.conversationsWithoutAgentId > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'orphaned',
            table: 'conversations',
            count: input.conversationsWithoutAgentId,
            message: `${input.conversationsWithoutAgentId} conversations sans agent_id`,
        }, { orphaned: true })
    }

    if (input.conversationsMissingAgent > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'orphaned',
            table: 'conversations',
            count: input.conversationsMissingAgent,
            message: `${input.conversationsMissingAgent} conversations pointent vers un agent inexistant`,
        }, { orphaned: true })
    }

    if (input.messagesWithoutConversationId > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'orphaned',
            table: 'messages',
            count: input.messagesWithoutConversationId,
            message: `${input.messagesWithoutConversationId} messages sans conversation_id`,
        }, { orphaned: true })
    }

    if (input.messagesMissingConversation > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'orphaned',
            table: 'messages',
            count: input.messagesMissingConversation,
            message: `${input.messagesMissingConversation} messages pointent vers une conversation inexistante`,
        }, { orphaned: true })
    }

    if (input.messagesMissingAgent > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'orphaned',
            table: 'messages',
            count: input.messagesMissingAgent,
            message: `${input.messagesMissingAgent} messages pointent vers un agent inexistant`,
        }, { orphaned: true })
    }

    if (input.stuckPayments > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'stuck',
            table: 'payments',
            count: input.stuckPayments,
            message: `${input.stuckPayments} paiements en attente depuis > 7 jours`,
        })
    }

    if (input.negativeCredits > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'anomaly',
            table: 'profiles',
            count: input.negativeCredits,
            message: `${input.negativeCredits} utilisateurs avec credits negatifs`,
        })
    }

    if (input.archivedActiveAgents > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'anomaly',
            table: 'agents',
            count: input.archivedActiveAgents,
            message: `${input.archivedActiveAgents} agents archives restent marques actifs`,
        })
    }

    if (input.overdueArchivedAgents > 0) {
        pushIssue(result.issues, result.stats, {
            type: 'anomaly',
            table: 'agents',
            count: input.overdueArchivedAgents,
            message: `${input.overdueArchivedAgents} agents archives depuis > 7 jours sont encore presents`,
        })
    }

    if (result.stats.orphanedRecords > 10 || input.archivedActiveAgents > 0 || input.overdueArchivedAgents > 0) {
        result.overallStatus = 'error'
    } else if (result.issues.length > 0) {
        result.overallStatus = 'warning'
    }

    return result
}
