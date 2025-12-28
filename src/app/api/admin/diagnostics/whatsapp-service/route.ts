import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const results: any = {
        whatsappService: { status: 'unknown', message: '' },
        pm2Status: { status: 'unknown', message: '' }
    }

    // 1. Check WhatsApp service via internal API
    try {
        // Try to reach the WhatsApp service health endpoint
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const res = await fetch('http://localhost:3001/health', {
            signal: controller.signal
        }).catch(() => null)

        clearTimeout(timeoutId)

        if (res && res.ok) {
            const data = await res.json().catch(() => null)
            results.whatsappService = {
                status: 'ok',
                message: 'Service WhatsApp actif',
                details: data?.uptime ? `Uptime: ${Math.floor(data.uptime / 60)}min` : undefined
            }
        } else {
            // Service might not have a health endpoint, check via PM2 status
            results.whatsappService = {
                status: 'warning',
                message: 'Health endpoint non disponible',
                details: 'Vérifiez via pm2 status'
            }
        }
    } catch (err: any) {
        if (err.name === 'AbortError') {
            results.whatsappService = {
                status: 'error',
                message: 'Timeout - service ne répond pas'
            }
        } else {
            results.whatsappService = {
                status: 'warning',
                message: 'Service peut être actif (port 3001)',
                details: 'Aucun endpoint health configuré'
            }
        }
    }

    // 2. Check if we can reach any agent's WhatsApp connection
    try {
        const res = await fetch('/api/admin/diagnostics/whatsapp')
        const data = await res.json()

        if (data.data) {
            results.agentConnections = {
                status: data.data.connected > 0 ? 'ok' : 'warning',
                message: `${data.data.connected}/${data.data.total} agents connectés`,
                connected: data.data.connected,
                total: data.data.total
            }
        }
    } catch (err) {
        results.agentConnections = {
            status: 'warning',
            message: 'Impossible de vérifier'
        }
    }

    return successResponse(results)
}
