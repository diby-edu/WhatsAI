import { NextRequest } from 'next/server'
import { successResponse, createAdminClient } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = createAdminClient()

    const results: any = {
        tables: [],
        issues: [],
        stats: {
            totalUsers: 0,
            totalAgents: 0,
            totalConversations: 0,
            totalPayments: 0,
            orphanedRecords: 0
        },
        overallStatus: 'ok'
    }

    try {
        // 1. Count users
        const { count: userCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
        results.stats.totalUsers = userCount || 0
        results.tables.push({ name: 'profiles', count: userCount || 0, status: 'ok' })

        // 2. Count agents
        const { count: agentCount } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
        results.stats.totalAgents = agentCount || 0
        results.tables.push({ name: 'agents', count: agentCount || 0, status: 'ok' })

        // 3. Count conversations
        const { count: convCount } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
        results.stats.totalConversations = convCount || 0
        results.tables.push({ name: 'conversations', count: convCount || 0, status: 'ok' })

        // 4. Count payments
        const { count: paymentCount } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
        results.stats.totalPayments = paymentCount || 0
        results.tables.push({ name: 'payments', count: paymentCount || 0, status: 'ok' })

        // 5. Count messages
        const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
        results.tables.push({ name: 'messages', count: messageCount || 0, status: 'ok' })

        // 6. Check for orphaned agents (without valid user_id)
        const { data: orphanedAgents } = await supabase
            .from('agents')
            .select('id, user_id')
            .is('user_id', null)

        if (orphanedAgents && orphanedAgents.length > 0) {
            results.stats.orphanedRecords += orphanedAgents.length
            results.issues.push({
                type: 'orphaned',
                table: 'agents',
                count: orphanedAgents.length,
                message: `${orphanedAgents.length} agents sans user_id`
            })
        }

        // 7. Check for failed payments stuck in pending
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)

        const { data: stuckPayments } = await supabase
            .from('payments')
            .select('id')
            .eq('status', 'pending')
            .lt('created_at', weekAgo.toISOString())

        if (stuckPayments && stuckPayments.length > 0) {
            results.issues.push({
                type: 'stuck',
                table: 'payments',
                count: stuckPayments.length,
                message: `${stuckPayments.length} paiements en attente depuis >7 jours`
            })
        }

        // 8. Check for users with negative credits
        const { data: negativeCredits } = await supabase
            .from('profiles')
            .select('id, credits_balance')
            .lt('credits_balance', 0)

        if (negativeCredits && negativeCredits.length > 0) {
            results.issues.push({
                type: 'anomaly',
                table: 'profiles',
                count: negativeCredits.length,
                message: `${negativeCredits.length} utilisateurs avec crédits négatifs`
            })
        }

        // 9. Check conversations without agent
        const { data: convWithoutAgent } = await supabase
            .from('conversations')
            .select('id')
            .is('agent_id', null)

        if (convWithoutAgent && convWithoutAgent.length > 0) {
            results.stats.orphanedRecords += convWithoutAgent.length
            results.issues.push({
                type: 'orphaned',
                table: 'conversations',
                count: convWithoutAgent.length,
                message: `${convWithoutAgent.length} conversations sans agent`
            })
        }

        // Set overall status
        if (results.issues.length > 3) {
            results.overallStatus = 'warning'
        }
        if (results.stats.orphanedRecords > 10) {
            results.overallStatus = 'error'
        }

    } catch (err: any) {
        console.error('Data integrity check error:', err)
        results.overallStatus = 'error'
        results.issues.push({
            type: 'error',
            message: err.message || 'Erreur lors de la vérification'
        })
    }

    return successResponse(results)
}
