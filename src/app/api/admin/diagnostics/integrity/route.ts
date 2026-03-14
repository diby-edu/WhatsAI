import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    const results: any = {
        tables: [],
        issues: [],
        stats: {
            totalUsers: 0,
            totalAgents: 0,
            totalConversations: 0,
            totalPayments: 0,
            orphanedRecords: 0,
        },
        overallStatus: 'ok',
    }

    try {
        const [usersResult, agentsResult, conversationsResult, paymentsResult, messagesResult] = await Promise.all([
            adminSupabase.from('profiles').select('*', { count: 'exact', head: true }),
            adminSupabase.from('agents').select('*', { count: 'exact', head: true }),
            adminSupabase.from('conversations').select('*', { count: 'exact', head: true }),
            adminSupabase.from('payments').select('*', { count: 'exact', head: true }),
            adminSupabase.from('messages').select('*', { count: 'exact', head: true }),
        ])

        results.stats.totalUsers = usersResult.count || 0
        results.stats.totalAgents = agentsResult.count || 0
        results.stats.totalConversations = conversationsResult.count || 0
        results.stats.totalPayments = paymentsResult.count || 0

        results.tables.push(
            { name: 'profiles', count: usersResult.count || 0, status: usersResult.error ? 'error' : 'ok' },
            { name: 'agents', count: agentsResult.count || 0, status: agentsResult.error ? 'error' : 'ok' },
            { name: 'conversations', count: conversationsResult.count || 0, status: conversationsResult.error ? 'error' : 'ok' },
            { name: 'payments', count: paymentsResult.count || 0, status: paymentsResult.error ? 'error' : 'ok' },
            { name: 'messages', count: messagesResult.count || 0, status: messagesResult.error ? 'error' : 'ok' },
        )

        const { data: orphanedAgents } = await adminSupabase
            .from('agents')
            .select('id')
            .is('user_id', null)

        if (orphanedAgents?.length) {
            results.stats.orphanedRecords += orphanedAgents.length
            results.issues.push({
                type: 'orphaned',
                table: 'agents',
                count: orphanedAgents.length,
                message: `${orphanedAgents.length} agents sans user_id`,
            })
        }

        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)

        const { data: stuckPayments } = await adminSupabase
            .from('payments')
            .select('id')
            .eq('status', 'pending')
            .lt('created_at', weekAgo.toISOString())

        if (stuckPayments?.length) {
            results.issues.push({
                type: 'stuck',
                table: 'payments',
                count: stuckPayments.length,
                message: `${stuckPayments.length} paiements en attente depuis > 7 jours`,
            })
        }

        const { data: negativeCredits } = await adminSupabase
            .from('profiles')
            .select('id')
            .lt('credits_balance', 0)

        if (negativeCredits?.length) {
            results.issues.push({
                type: 'anomaly',
                table: 'profiles',
                count: negativeCredits.length,
                message: `${negativeCredits.length} utilisateurs avec credits negatifs`,
            })
        }

        const { data: conversationsWithoutAgent } = await adminSupabase
            .from('conversations')
            .select('id')
            .is('agent_id', null)

        if (conversationsWithoutAgent?.length) {
            results.stats.orphanedRecords += conversationsWithoutAgent.length
            results.issues.push({
                type: 'orphaned',
                table: 'conversations',
                count: conversationsWithoutAgent.length,
                message: `${conversationsWithoutAgent.length} conversations sans agent`,
            })
        }

        if (results.stats.orphanedRecords > 10) results.overallStatus = 'error'
        else if (results.issues.length > 0) results.overallStatus = 'warning'
    } catch (err: any) {
        console.error('Data integrity check error:', err)
        results.overallStatus = 'error'
        results.issues.push({
            type: 'error',
            message: err.message || 'Erreur lors de la verification',
        })
    }

    return successResponse(results)
}
