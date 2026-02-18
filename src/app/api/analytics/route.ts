import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        // Get User's Agents
        const { data: agents } = await supabase
            .from('agents')
            .select('id, name')
            .eq('user_id', user.id)

        const agentIds = agents?.map(a => a.id) || []

        // 1. Total Sales (Paid/Confirmed orders)
        const { data: salesData } = await supabase
            .from('orders')
            .select('total_fcfa')
            .eq('user_id', user.id)
            .in('status', ['paid', 'confirmed', 'delivered'])

        const totalSales = salesData?.reduce((sum, order) => sum + (order.total_fcfa || 0), 0) || 0
        const totalOrders = salesData?.length || 0

        // 2. Total Messages (AI Activity)
        let messageCount = 0
        if (agentIds.length > 0) {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('agent_id', agentIds)
            messageCount = count || 0
        }

        // 3. Sales Over Time (Last 30 days)
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
            const date = new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
            salesByDate[date] = (salesByDate[date] || 0) + (order.total_fcfa || 0)
        })

        const chartData = Object.keys(salesByDate).map(date => ({
            date,
            sales: salesByDate[date]
        }))

        // 4. Top Products (by quantity sold)
        let topProducts: { name: string; quantity: number; revenue: number }[] = []
        try {
            const { data: orderItems } = await supabase
                .from('order_items')
                .select(`
                    quantity,
                    total_price,
                    product:products(name),
                    order:orders!inner(user_id, status)
                `)
                .eq('order.user_id', user.id)
                .in('order.status', ['paid', 'confirmed', 'delivered'])

            if (orderItems && orderItems.length > 0) {
                // Aggregate by product name
                const productMap: Record<string, { quantity: number; revenue: number }> = {}
                for (const item of orderItems) {
                    const name = (item.product as any)?.name || 'Produit inconnu'
                    if (!productMap[name]) {
                        productMap[name] = { quantity: 0, revenue: 0 }
                    }
                    productMap[name].quantity += item.quantity || 1
                    productMap[name].revenue += item.total_price || 0
                }

                topProducts = Object.entries(productMap)
                    .map(([name, stats]) => ({ name, ...stats }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 5)
            }
        } catch (topErr) {
            console.error('Top products error (non-blocking):', topErr)
            // Continue without top products
        }

        return successResponse({
            kpi: {
                totalSales,
                totalOrders,
                averageOrderValue: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
                totalMessages: messageCount
            },
            chartData,
            topProducts
        })
    } catch (error: any) {
        console.error('Analytics Error:', error)
        return errorResponse(error.message, 500)
    }
}
