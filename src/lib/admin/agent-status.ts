export type AgentOperationalStatus = 'paused' | 'connected' | 'qr_ready' | 'reconnect_required'

export interface AgentStatusLike {
    is_active?: boolean | null
    whatsapp_connected?: boolean | null
    whatsapp_status?: string | null
    whatsapp_phone?: string | null
}

export function getAgentOperationalStatus(agent: AgentStatusLike): AgentOperationalStatus {
    if (!agent.is_active) {
        return 'paused'
    }

    if (agent.whatsapp_connected) {
        return 'connected'
    }

    if (agent.whatsapp_phone || agent.whatsapp_status === 'disconnected') {
        return 'reconnect_required'
    }

    return 'qr_ready'
}

export function getAgentOperationalLabel(status: AgentOperationalStatus): string {
    switch (status) {
        case 'paused':
            return 'Pause'
        case 'connected':
            return 'Connecte'
        case 'reconnect_required':
            return 'A reconnecter'
        case 'qr_ready':
        default:
            return 'QR a scanner'
    }
}

export function getAgentOperationalColors(status: AgentOperationalStatus) {
    switch (status) {
        case 'paused':
            return {
                badgeBg: 'rgba(245, 158, 11, 0.15)',
                badgeText: '#fbbf24',
                iconBg: 'linear-gradient(135deg, #475569, #334155)',
            }
        case 'connected':
            return {
                badgeBg: 'rgba(34, 197, 94, 0.15)',
                badgeText: '#4ade80',
                iconBg: 'linear-gradient(135deg, #10b981, #059669)',
            }
        case 'reconnect_required':
            return {
                badgeBg: 'rgba(249, 115, 22, 0.15)',
                badgeText: '#fb923c',
                iconBg: 'linear-gradient(135deg, #f97316, #ea580c)',
            }
        case 'qr_ready':
        default:
            return {
                badgeBg: 'rgba(100, 116, 139, 0.18)',
                badgeText: '#cbd5e1',
                iconBg: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            }
    }
}

export function getAgentOperationalDetail(agent: AgentStatusLike): string {
    const status = getAgentOperationalStatus(agent)

    if (status === 'connected' && agent.whatsapp_phone) {
        return agent.whatsapp_phone
    }

    if (status === 'reconnect_required' && agent.whatsapp_phone) {
        return `${getAgentOperationalLabel(status)} (${agent.whatsapp_phone})`
    }

    return getAgentOperationalLabel(status)
}
