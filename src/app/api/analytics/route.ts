import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        // 1. Total Sales (Paid/Confirmed orders)
        const { data: salesData } = await supabase
            .from('orders')
            .select('total_fcfa')
            .eq('user_id', user.id)
            .in('status', ['paid', 'confirmed', 'delivered'])

        const totalSales = salesData?.reduce((sum, order) => sum + (order.total_fcfa || 0), 0) || 0
        const totalOrders = salesData?.length || 0

        // 2. Total Messages (AI Activity)
        const { count: totalMessages } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', user.id) // Assuming agent_id relates to user's agents, need join or user check. 
        // Wait, messages have agent_id. Agents have user_id. 
        // Better to query agents first.

        // Get User's Agents
        const { data: agents } = await supabase
            .from('agents')
            .select('id, name')
            .eq('user_id', user.id)

        const agentIds = agents?.map(a => a.id) || []

        let messageCount = 0
        if (agentIds.length > 0) {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('agent_id', agentIds)
            messageCount = count || 0
        }

        // 3. Sales Over Time (Last 7 days mock or real)
        // Check if we can do group by day in Supabase easily without RPC.
        // For simplicity, fetch last 30 days orders and aggregate in JS.
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: recentOrders } = await supabase
            .from('orders')
            .select('created_at, total_fcfa')
            .eq('user_id', user.id)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: true })

        // Aggregate by date
        const salesByDate: Record<string, number> = {}
        recentOrders?.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString()
            salesByDate[date] = (salesByDate[date] || 0) + (order.total_fcfa || 0)
        })

        const chartData = Object.keys(salesByDate).map(date => ({
            date,
            sales: salesByDate[date]
        }))

        return successResponse({
            kpi: {
                totalSales,
                totalOrders,
                averageOrderValue: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
                totalMessages: messageCount
            },
            chartData
        })
    } catch (error: any) {
        console.error('Analytics Error:', error)
        return errorResponse(error.message, 500)
    }
}
