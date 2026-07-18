import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { aggregateSalesByDate, aggregateTopProducts } from '@/lib/services/analytics-metrics'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        // Période : from/to en query params, défaut = mois en cours
        const { searchParams } = new URL(request.url)
        let dateFrom: Date
        let dateTo: Date = new Date()

        const fromParam = searchParams.get('from')
        const toParam = searchParams.get('to')

        if (fromParam && toParam) {
            dateFrom = new Date(fromParam)
            dateTo = new Date(toParam)
        } else {
            // Défaut : mois en cours
            dateFrom = new Date()
            dateFrom.setDate(1)
            dateFrom.setHours(0, 0, 0, 0)
        }

        const fromISO = dateFrom.toISOString()
        const toISO = dateTo.toISOString()

        // Get User's Agents
        const { data: agents } = await supabase
            .from('agents')
            .select('id, name')
            .eq('user_id', user.id)

        const agentIds = agents?.map(a => a.id) || []

        // 1. Total Sales (Paid/Confirmed orders) — sur la période
        const { data: salesData } = await supabase
            .from('orders')
            .select('total_fcfa')
            .eq('user_id', user.id)
            .in('status', ['paid', 'confirmed', 'delivered'])
            .gte('created_at', fromISO)
            .lte('created_at', toISO)

        const totalSales = salesData?.reduce((sum, order) => sum + (order.total_fcfa || 0), 0) || 0
        const totalOrders = salesData?.length || 0

        // 2. Total Messages (AI Activity) — sur la période
        let messageCount = 0
        if (agentIds.length > 0) {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('agent_id', agentIds)
                .gte('created_at', fromISO)
                .lte('created_at', toISO)
            messageCount = count || 0
        }

        // 3b. Conversations — sur la période
        let conversationCount = 0
        if (agentIds.length > 0) {
            const { count } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
                .in('agent_id', agentIds)
                .gte('created_at', fromISO)
                .lte('created_at', toISO)
            conversationCount = count || 0
        }

        // 3c. Crédits consommés (messages IA role=assistant) — sur la période
        let creditsConsumed = 0
        if (agentIds.length > 0) {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('agent_id', agentIds)
                .eq('role', 'assistant')
                .gte('created_at', fromISO)
                .lte('created_at', toISO)
            creditsConsumed = count || 0
        }

        // 3. Sales Over Time — sur la période
        const { data: recentOrders } = await supabase
            .from('orders')
            .select('created_at, total_fcfa')
            .eq('user_id', user.id)
            .gte('created_at', fromISO)
            .lte('created_at', toISO)
            .order('created_at', { ascending: true })

        const chartData = aggregateSalesByDate(recentOrders)

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

            topProducts = aggregateTopProducts(orderItems as any)
        } catch (topErr) {
            console.error('Top products error (non-blocking):', topErr)
            // Continue without top products
        }

        return successResponse({
            kpi: {
                totalSales,
                totalOrders,
                averageOrderValue: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
                totalMessages: messageCount,
                conversationCount,
                creditsConsumed,
                orderRate: conversationCount > 0 ? Math.round((totalOrders / conversationCount) * 100) : null
            },
            chartData,
            topProducts
        })
    } catch (error: any) {
        console.error('Analytics Error:', error)
        return errorResponse(error.message, 500)
    }
}
