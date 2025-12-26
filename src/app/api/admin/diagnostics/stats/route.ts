import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès réservé aux administrateurs', 403)
    }

    try {
        // Total users
        const { count: totalUsers } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        // Active users (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const { count: activeUsers } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('updated_at', thirtyDaysAgo.toISOString())

        // Agents
        const { count: totalAgents } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })

        const { count: connectedAgents } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('whatsapp_connected', true)

        // Conversations
        const { count: totalConversations } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })

        // Messages
        const { count: totalMessages } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })

        // Credits used
        const { data: creditsData } = await supabase
            .from('profiles')
            .select('credits_used_this_month')

        const totalCreditsUsed = (creditsData || []).reduce((sum, p) => sum + (p.credits_used_this_month || 0), 0)

        // Products
        const { count: totalProducts } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })

        // Orders
        const { count: totalOrders } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })

        const { count: pendingOrders } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')

        return successResponse({
            totalUsers: totalUsers || 0,
            activeUsers: activeUsers || 0,
            totalAgents: totalAgents || 0,
            connectedAgents: connectedAgents || 0,
            totalConversations: totalConversations || 0,
            totalMessages: totalMessages || 0,
            totalCreditsUsed,
            totalProducts: totalProducts || 0,
            totalOrders: totalOrders || 0,
            pendingOrders: pendingOrders || 0
        })
    } catch (err) {
        console.error('Error fetching stats:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
