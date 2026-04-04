import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

async function verifyAdmin(supabase: any, adminSupabase: any, userId: string) {
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
    if (!(await verifyAdmin(supabase, adminSupabase, user.id))) {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const last7  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString()

        // Requêtes parallèles pour performance
        const [
            { count: totalCalls },
            { count: callsToday },
            { count: callsLast7 },
            { count: totalKeys },
            { count: activeKeys },
            { count: usersWithAccess },
            { data: errorData },
            { data: topUsers },
            { data: dailyData },
        ] = await Promise.all([
            adminSupabase.from('api_usage_logs').select('*', { count: 'exact', head: true }),
            adminSupabase.from('api_usage_logs').select('*', { count: 'exact', head: true }).gte('created_at', today),
            adminSupabase.from('api_usage_logs').select('*', { count: 'exact', head: true }).gte('created_at', last7),
            adminSupabase.from('api_keys').select('*', { count: 'exact', head: true }),
            adminSupabase.from('api_keys').select('*', { count: 'exact', head: true }).eq('is_active', true),
            adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('api_access_enabled', true),
            // Taux d'erreur (codes >= 400)
            adminSupabase.from('api_usage_logs')
                .select('status_code')
                .gte('created_at', last7)
                .gte('status_code', 400),
            // Top 10 utilisateurs par volume
            adminSupabase.from('api_usage_logs')
                .select('user_id')
                .gte('created_at', last30)
                .limit(1000),
            // Volume par jour (30 derniers jours)
            adminSupabase.from('api_usage_logs')
                .select('created_at, status_code')
                .gte('created_at', last30)
                .order('created_at', { ascending: true })
                .limit(5000),
        ])

        // Calcul taux d'erreur
        const totalLast7 = callsLast7 || 0
        const errorCount = errorData?.length || 0
        const errorRate = totalLast7 > 0 ? Math.round((errorCount / totalLast7) * 100) : 0

        // Top utilisateurs
        const userCounts: Record<string, number> = {}
        ;(topUsers || []).forEach((row: any) => {
            userCounts[row.user_id] = (userCounts[row.user_id] || 0) + 1
        })
        const topUsersRanked = Object.entries(userCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([user_id, count]) => ({ user_id, count }))

        // Volume par jour
        const byDay: Record<string, { total: number; errors: number }> = {}
        ;(dailyData || []).forEach((row: any) => {
            const day = row.created_at.slice(0, 10)
            if (!byDay[day]) byDay[day] = { total: 0, errors: 0 }
            byDay[day].total++
            if (row.status_code >= 400) byDay[day].errors++
        })
        const dailyStats = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, stats]) => ({ date, ...stats }))

        return successResponse({
            overview: {
                total_calls: totalCalls || 0,
                calls_today: callsToday || 0,
                calls_last_7_days: callsLast7 || 0,
                total_keys: totalKeys || 0,
                active_keys: activeKeys || 0,
                users_with_access: usersWithAccess || 0,
                error_rate_percent: errorRate,
            },
            top_users: topUsersRanked,
            daily_stats: dailyStats,
        })
    } catch (err) {
        console.error('Admin api-stats error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
