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
        // Get Admin Alerts from View (defined in Phase 4 migration)
        const { data: alerts, error } = await adminSupabase
            .from('view_admin_alerts')
            .select('*')
            .order('severity', { ascending: false }) // Critical first
            .limit(20)

        if (error) throw error

        return successResponse(alerts)
    } catch (err: any) {
        console.error('Admin alerts API error:', err)
        return errorResponse(err.message, 500)
    }
}
