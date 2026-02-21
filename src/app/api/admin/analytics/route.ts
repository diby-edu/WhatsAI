import { NextRequest } from 'next/server'
import { createAdminClient, getAuthUser, errorResponse, successResponse, createApiClient } from '@/lib/api-utils'

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

    // Parse period parameter
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    switch (period) {
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
        case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
            break
        case '12m':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
            break
        default: // 30d
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    const startDateStr = startDate.toISOString().split('T')[0]

    try {
        // 1. Get Payment Analytics from View (Time Series) - Filter by period
        const { data: revenueSeriesRaw } = await adminSupabase
            .from('view_analytics_revenue_time_series')
            .select('*')
            .gte('date', startDateStr)
            .order('date', { ascending: true })

        // 2. Get User Growth Analytics (Time Series) - Filter by period
        const { data: userSeriesRaw } = await adminSupabase
            .from('view_analytics_user_growth')
            .select('*')
            .gte('date', startDateStr)
            .order('date', { ascending: true })

        // 3. Get Admin Alerts from View
        const { data: adminAlerts } = await adminSupabase
            .from('view_admin_alerts')
            .select('*')
            .order('days_since_active', { ascending: false })

        // 4. Get Recent Messages Stats - Use period-aware query
        let messageSeries
        if (period === '7d') {
            const { data } = await adminSupabase.rpc('get_message_stats_last_7_days')
            messageSeries = data
        } else {
            // For longer periods, try to get more message data
            const { data } = await adminSupabase
                .from('messages')
                .select('created_at')
                .gte('created_at', startDateStr)

            // Aggregate by day
            const messagesByDay: Record<string, number> = {}
            data?.forEach((m: any) => {
                const day = new Date(m.created_at).toLocaleDateString('fr-FR', { weekday: 'short' })
                messagesByDay[day] = (messagesByDay[day] || 0) + 1
            })
            messageSeries = Object.entries(messagesByDay).map(([day, count]) => ({
                day,
                total_messages: count
            }))
        }

        return successResponse({
            revenueSeries: revenueSeriesRaw || [],
            userSeries: userSeriesRaw || [],
            alerts: adminAlerts || [],
            messageSeries: messageSeries || [],
            period
        })

    } catch (err) {
        console.error('Admin Analytics API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
