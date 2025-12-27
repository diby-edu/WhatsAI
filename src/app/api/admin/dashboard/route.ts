import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 403)
    }

    // Check admin via profile role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Non autorisé', 403)
    }

    const adminSupabase = createAdminClient()

    try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        // Total Users
        const { count: totalUsers } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        // Active Users (30 days)
        const { count: activeUsers } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('updated_at', thirtyDaysAgo.toISOString())

        // New Users Today
        const { count: newUsersToday } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString())

        // Total Agents
        const { count: totalAgents } = await adminSupabase
            .from('agents')
            .select('*', { count: 'exact', head: true })

        // Connected Agents
        const { count: connectedAgents } = await adminSupabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('whatsapp_connected', true)

        // Messages count
        let totalMessages = 0
        let messagesToday = 0
        try {
            const { count: msgCount } = await adminSupabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
            totalMessages = msgCount || 0

            const { count: msgToday } = await adminSupabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString())
            messagesToday = msgToday || 0
        } catch { }

        // Conversations
        let totalConversations = 0
        let conversationsToday = 0
        try {
            const { count: convCount } = await adminSupabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
            totalConversations = convCount || 0

            const { count: convToday } = await adminSupabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString())
            conversationsToday = convToday || 0
        } catch { }

        // Credits used
        let totalCreditsUsed = 0
        try {
            const { data: profiles } = await adminSupabase
                .from('profiles')
                .select('credits_used_this_month')
            totalCreditsUsed = profiles?.reduce((sum, p) => sum + (p.credits_used_this_month || 0), 0) || 0
        } catch { }

        // Revenue from payments
        let revenue = 0
        try {
            const { data: payments } = await adminSupabase
                .from('payments')
                .select('amount')
                .eq('status', 'completed')
                .gte('created_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
            revenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
        } catch { }

        // Orders
        let totalOrders = 0
        let pendingOrders = 0
        try {
            const { count: ordersCount } = await adminSupabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
            totalOrders = ordersCount || 0

            const { count: pendCount } = await adminSupabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending')
            pendingOrders = pendCount || 0
        } catch { }

        // Recent Users
        const { data: recentUsers } = await adminSupabase
            .from('profiles')
            .select('id, full_name, email, created_at, subscription_plan')
            .order('created_at', { ascending: false })
            .limit(5)

        return successResponse({
            stats: {
                totalUsers: totalUsers || 0,
                activeUsers: activeUsers || 0,
                newUsersToday: newUsersToday || 0,
                totalAgents: totalAgents || 0,
                activeAgents: totalAgents || 0,
                connectedAgents: connectedAgents || 0,
                totalMessages,
                messagesToday,
                totalConversations,
                conversationsToday,
                totalCreditsUsed,
                revenue,
                totalOrders,
                pendingOrders
            },
            recentUsers: recentUsers || []
        })

    } catch (err) {
        console.error('Admin dashboard API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
