import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

type BotSession = { id: string; status: string }
type BotPayload = {
    activeSessions: BotSession[]
    pendingConnections: string[]
    scheduledConnections: string[]
} | null

async function fetchBotSessions(): Promise<BotPayload> {
    try {
        const response = await fetch('http://localhost:3001/sessions', {
            signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) return null
        return await response.json().catch(() => null)
    } catch {
        return null
    }
}

export async function GET(_request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const [agentsResult, botSessions] = await Promise.all([
            adminSupabase
                .from('agents')
                .select('id, name, is_active, whatsapp_connected, whatsapp_status, whatsapp_phone')
                .order('name', { ascending: true }),
            fetchBotSessions(),
        ])

        if (agentsResult.error) throw agentsResult.error

        const agents = agentsResult.data || []

        // Map agentId → bot socket status ('connected' | 'connecting' | 'qr_waiting' | ...)
        const botSessionMap = new Map<string, string>()
        for (const s of botSessions?.activeSessions || []) {
            botSessionMap.set(s.id, s.status)
        }
        const pendingSet = new Set(botSessions?.pendingConnections || [])
        const scheduledSet = new Set(botSessions?.scheduledConnections || [])

        const matrix = agents.map((agent) => {
            const botSocketStatus = botSessionMap.get(agent.id) ?? null
            // "actif" uniquement si le socket est vraiment connecté (pas QR, pas connecting)
            const botActive = botSocketStatus === 'connected'
            const botConnecting = botSocketStatus !== null && botSocketStatus !== 'connected'
            const isPending = pendingSet.has(agent.id)
            const isScheduled = scheduledSet.has(agent.id)
            const dbConnected = agent.whatsapp_connected === true

            // DESYNC = DB dit connecté mais bot n'a pas de socket vraiment connecté
            const coherent = dbConnected === botActive

            return {
                id: agent.id,
                name: agent.name,
                is_active: agent.is_active,
                db_connected: dbConnected,
                db_status: agent.whatsapp_status || 'unknown',
                phone: agent.whatsapp_phone || null,
                bot_active: botActive,
                bot_connecting: botConnecting,
                bot_socket_status: botSocketStatus,
                bot_pending: isPending,
                bot_scheduled: isScheduled,
                coherent,
            }
        })

        const incoherentCount = matrix.filter((a) => !a.coherent).length
        const botReachable = botSessions !== null

        return successResponse({
            botReachable,
            totalAgents: matrix.length,
            incoherentCount,
            agents: matrix,
        })
    } catch (err: any) {
        console.error('WhatsApp state diagnostics error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
