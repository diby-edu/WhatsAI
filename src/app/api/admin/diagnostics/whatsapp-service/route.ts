import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { getAgentOperationalMetrics, getWhatsAppRiskReport } from '@/lib/admin/monitoring'
import { getInternalBotBaseUrl } from '@/lib/whatsapp/internal-bot'

async function probeBotService() {
    try {
        const response = await fetch(`${getInternalBotBaseUrl()}/health`, {
            signal: AbortSignal.timeout(5000),
        })

        if (!response.ok) {
            return {
                status: 'error',
                message: 'Health endpoint en erreur',
                details: `HTTP ${response.status}`,
            }
        }

        const data = await response.json().catch(() => null)
        return {
            status: 'ok',
            message: 'Service WhatsApp actif',
            details: data?.uptime ? `Uptime: ${Math.floor(data.uptime / 60)} min` : undefined,
        }
    } catch (err: any) {
        return {
            status: 'warning',
            message: 'Service WhatsApp non joignable',
            details: err.message || 'Unavailable',
        }
    }
}

export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const [whatsappService, agentConnections, riskReport] = await Promise.all([
            probeBotService(),
            getAgentOperationalMetrics(adminSupabase),
            getWhatsAppRiskReport(adminSupabase),
        ])

        return successResponse({
            whatsappService,
            agentConnections: {
                status: agentConnections.connected > 0 ? 'ok' : 'warning',
                message: `${agentConnections.connected}/${agentConnections.total} agents connectes`,
                details: `Connexion: ${agentConnections.connecting} | A connecter: ${agentConnections.qr_ready} | A reconnecter: ${agentConnections.reconnect_required} | Desactives: ${agentConnections.paused}`,
                ...agentConnections,
            },
            riskReport,
        })
    } catch (err: any) {
        console.error('WhatsApp service diagnostics error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}

