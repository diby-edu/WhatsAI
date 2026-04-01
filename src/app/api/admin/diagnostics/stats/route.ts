import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { getAgentOperationalMetrics, getWhatsAppRiskReport } from '@/lib/admin/monitoring'

export async function GET() {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const [
            usersResult,
            activeUsersResult,
            conversationsResult,
            messagesResult,
            creditsResult,
            productsResult,
            ordersResult,
            pendingOrdersResult,
            agentMetrics,
            riskReport,
        ] = await Promise.all([
            adminSupabase.from('profiles').select('*', { count: 'exact', head: true }),
            adminSupabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gte('updated_at', thirtyDaysAgo.toISOString()),
            adminSupabase.from('conversations').select('*', { count: 'exact', head: true }),
            adminSupabase.from('messages').select('*', { count: 'exact', head: true }),
            adminSupabase.from('profiles').select('credits_used_this_month'),
            adminSupabase.from('products').select('*', { count: 'exact', head: true }),
            adminSupabase.from('orders').select('*', { count: 'exact', head: true }),
            adminSupabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            getAgentOperationalMetrics(adminSupabase),
            getWhatsAppRiskReport(adminSupabase),
        ])

        const totalCreditsUsed = (creditsResult.data || []).reduce((sum: number, profile: any) => {
            return sum + (profile.credits_used_this_month || 0)
        }, 0)

        return successResponse({
            totalUsers: usersResult.count || 0,
            activeUsers: activeUsersResult.count || 0,
            totalAgents: agentMetrics.total || 0,
            connectedAgents: agentMetrics.connected || 0,
            qrReadyAgents: agentMetrics.qr_ready || 0,
            reconnectAgents: agentMetrics.reconnect_required || 0,
            pausedAgents: agentMetrics.paused || 0,
            whatsappAtRiskAgents: riskReport.total || 0,
            totalConversations: conversationsResult.count || 0,
            totalMessages: messagesResult.count || 0,
            totalCreditsUsed,
            totalProducts: productsResult.count || 0,
            totalOrders: ordersResult.count || 0,
            pendingOrders: pendingOrdersResult.count || 0,
        })
    } catch (err) {
        console.error('Error fetching stats:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
