import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { getAgentOperationalMetrics, getWhatsAppRiskReport } from '@/lib/admin/monitoring'

export async function GET() {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const [metrics, riskReport] = await Promise.all([
            getAgentOperationalMetrics(adminSupabase),
            getWhatsAppRiskReport(adminSupabase),
        ])

        return successResponse({
            ...metrics,
            riskReport,
        })
    } catch (err: any) {
        console.error('WhatsApp diagnostics error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
