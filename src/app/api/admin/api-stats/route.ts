import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

async function verifyAdmin(adminSupabase: ReturnType<typeof createAdminClient>, userId: string) {
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
    return profile?.role === 'admin' || profile?.role === 'superadmin'
}

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminSupabase = createAdminClient()
    if (!(await verifyAdmin(adminSupabase, user.id))) {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const last7  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString()

        const [
            { count: totalCalls },
            { count: callsToday },
            { count: callsLast7 },
            { count: callsLast30 },
            { count: totalKeys },
            { count: activeKeys },
            { count: usersWithAccess },
            { count: totalUsers },
            { count: webhooksCount },
            { count: syncedDataCount },
            { data: errorData },
            { data: latencyData },
            { data: endpointData },
            { data: topUsers },
            { data: dailyData },
            { data: lastCallData },
        ] = await Promise.all([
            // Volumes
            adminSupabase.from('api_usage_logs').select('*', { count: 'exact', head: true }),
            adminSupabase.from('api_usage_logs').select('*', { count: 'exact', head: true }).gte('created_at', today),
            adminSupabase.from('api_usage_logs').select('*', { count: 'exact', head: true }).gte('created_at', last7),
            adminSupabase.from('api_usage_logs').select('*', { count: 'exact', head: true }).gte('created_at', last30),
            // Clés
            adminSupabase.from('api_keys').select('*', { count: 'exact', head: true }),
            adminSupabase.from('api_keys').select('*', { count: 'exact', head: true }).eq('is_active', true),
            // Utilisateurs
            adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('api_access_enabled', true),
            adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).not('role', 'in', '("admin","superadmin")'),
            // Webhooks & données sync
            adminSupabase.from('api_webhooks').select('*', { count: 'exact', head: true }).eq('is_active', true),
            adminSupabase.from('agent_external_data').select('*', { count: 'exact', head: true }),
            // Taux d'erreur (codes >= 400 sur 7j)
            adminSupabase.from('api_usage_logs').select('status_code').gte('created_at', last7).gte('status_code', 400),
            // Latence moyenne (30j)
            adminSupabase.from('api_usage_logs').select('response_ms').gte('created_at', last30).not('response_ms', 'is', null).limit(2000),
            // Top endpoints (30j)
            adminSupabase.from('api_usage_logs').select('endpoint').gte('created_at', last30).limit(2000),
            // Top utilisateurs (30j)
            adminSupabase.from('api_usage_logs').select('user_id').gte('created_at', last30).limit(1000),
            // Volume par jour (30j)
            adminSupabase.from('api_usage_logs').select('created_at, status_code').gte('created_at', last30).order('created_at', { ascending: true }).limit(5000),
            // Dernier appel
            adminSupabase.from('api_usage_logs').select('created_at, endpoint, status_code').order('created_at', { ascending: false }).limit(1),
        ])

        // Taux d'erreur
        const totalLast7 = callsLast7 || 0
        const errorCount = errorData?.length || 0
        const errorRate = totalLast7 > 0 ? Math.round((errorCount / totalLast7) * 100) : 0

        // Taux de succès
        const successRate = 100 - errorRate

        // Latence moyenne
        const latencies = (latencyData || []).map((r: { response_ms: number }) => r.response_ms).filter((v: number) => v > 0)
        const avgResponseMs = latencies.length > 0
            ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
            : 0

        // Top endpoints
        const endpointCounts: Record<string, number> = {}
        ;(endpointData || []).forEach((row: { endpoint: string | null }) => {
            const ep = row.endpoint || 'unknown'
            endpointCounts[ep] = (endpointCounts[ep] || 0) + 1
        })
        const topEndpoints = Object.entries(endpointCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([endpoint, count]) => ({
                endpoint: endpoint.replace('/api/public/v1/', '/').replace('/api/developer/', 'dev/'),
                count,
                percent: totalCalls ? Math.round((count / (totalCalls as number)) * 100) : 0
            }))

        // Top utilisateurs
        const userCounts: Record<string, number> = {}
        ;(topUsers || []).forEach((row: { user_id: string }) => {
            userCounts[row.user_id] = (userCounts[row.user_id] || 0) + 1
        })
        const topUsersRanked = Object.entries(userCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([user_id, count]) => ({ user_id, count }))

        // Volume par jour
        const byDay: Record<string, { total: number; errors: number }> = {}
        ;(dailyData || []).forEach((row: { created_at: string; status_code: number }) => {
            const day = row.created_at.slice(0, 10)
            if (!byDay[day]) byDay[day] = { total: 0, errors: 0 }
            byDay[day].total++
            if (row.status_code >= 400) byDay[day].errors++
        })
        const dailyStats = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, stats]) => ({ date, ...stats }))

        // Dernier appel
        const lastCall = lastCallData?.[0] || null

        return successResponse({
            overview: {
                total_calls: totalCalls || 0,
                calls_today: callsToday || 0,
                calls_last_7_days: callsLast7 || 0,
                calls_last_30_days: callsLast30 || 0,
                total_keys: totalKeys || 0,
                active_keys: activeKeys || 0,
                users_with_access: usersWithAccess || 0,
                total_users: totalUsers || 0,
                webhooks_active: webhooksCount || 0,
                synced_data_count: syncedDataCount || 0,
                error_rate_percent: errorRate,
                success_rate_percent: successRate,
                avg_response_ms: avgResponseMs,
                last_call: lastCall,
            },
            top_endpoints: topEndpoints,
            top_users: topUsersRanked,
            daily_stats: dailyStats,
        })
    } catch (err) {
        console.error('Admin api-stats error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
