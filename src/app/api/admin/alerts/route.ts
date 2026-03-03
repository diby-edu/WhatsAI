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

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Non autorisé', 403)
    }

    const adminSupabase = createAdminClient()

    try {
        // 1. Condition-based system alerts from SQL VIEW
        const { data: systemAlerts, error: viewError } = await adminSupabase
            .from('view_admin_alerts')
            .select('*')
            .order('severity', { ascending: false }) // Critical first
            .limit(20)

        if (viewError) throw viewError

        // 2. Event-based notifications from admin_notifications table (most recent 30)
        const { data: eventNotifs } = await adminSupabase
            .from('admin_notifications')
            .select('id, type, title, message, data, created_at')
            .order('created_at', { ascending: false })
            .limit(30)

        // 3. Normalize event notifications to match the alert shape expected by the UI
        const normalizedEvents = (eventNotifs || []).map((n: any) => ({
            type: n.type,
            resource_id: n.id,       // stable unique ID for read tracking
            label: n.title,
            message: n.message,
            severity: getSeverity(n.type),
            days_since_active: 0,
            created_at: n.created_at,
        }))

        // 4. Merge: system alerts first, then event notifications
        const merged = [...(systemAlerts || []), ...normalizedEvents]

        return successResponse(merged)
    } catch (err: any) {
        console.error('Admin alerts API error:', err)
        return errorResponse(err.message, 500)
    }
}

function getSeverity(type: string): string {
    const critical = ['payment_failed', 'openai_error', 'whatsapp_down', 'high_error_rate', 'escalation', 'agent_disconnected']
    const warning = ['payment_received', 'plan_downgrade', 'subscription_cancelled', 'agent_quota_exceeded']
    if (critical.includes(type)) return 'critical'
    if (warning.includes(type)) return 'warning'
    return 'info'
}
