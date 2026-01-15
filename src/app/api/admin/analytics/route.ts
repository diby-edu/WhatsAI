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

    try {
        // 1. Get Payment Analytics from View
        const { data: paymentsAnalytics, error: pError } = await adminSupabase
            .from('view_analytics_payments')
            .select('*')

        // 2. Get Admin Alerts from View
        const { data: adminAlerts, error: aError } = await adminSupabase
            .from('view_admin_alerts')
            .select('*')
            .order('days_since_active', { ascending: false })

        // 3. Get Recent Messages Stats (Last 7 days)
        const { data: messageStats } = await adminSupabase
            .rpc('get_message_stats_last_7_days') // We might need to create this RPC or do a manual query

        return successResponse({
            payments: paymentsAnalytics || [],
            alerts: adminAlerts || [],
            messageStats: messageStats || []
        })

    } catch (err) {
        console.error('Admin Analytics API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
