import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { buildAdminAlerts } from '@/lib/admin/monitoring'

function getSeverity(type: string): 'critical' | 'warning' | 'info' {
    const critical = ['payment_failed', 'openai_error', 'whatsapp_down', 'high_error_rate', 'escalation', 'agent_disconnected']
    const warning = ['payment_received', 'plan_downgrade', 'subscription_cancelled', 'agent_quota_exceeded']
    if (critical.includes(type)) return 'critical'
    if (warning.includes(type)) return 'warning'
    return 'info'
}

export async function GET() {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const [systemAlerts, eventNotifsResult] = await Promise.all([
            buildAdminAlerts(adminSupabase),
            adminSupabase
                .from('admin_notifications')
                .select('id, type, title, message, data, created_at')
                .order('created_at', { ascending: false })
                .limit(30),
        ])

        if (eventNotifsResult.error) throw eventNotifsResult.error

        const normalizedEvents = (eventNotifsResult.data || []).map((notification: any) => ({
            type: notification.type,
            resource_id: notification.id,
            label: notification.title,
            message: notification.message,
            severity: getSeverity(notification.type),
            days_since_active: 0,
            created_at: notification.created_at,
        }))

        return successResponse([...systemAlerts, ...normalizedEvents])
    } catch (err: any) {
        console.error('Admin alerts API error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
