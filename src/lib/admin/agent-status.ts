export type AgentOperationalStatus = 'paused' | 'connected' | 'qr_ready' | 'reconnect_required'

export interface AgentStatusLike {
    is_active?: boolean | null
    whatsapp_connected?: boolean | null
    whatsapp_status?: string | null
    whatsapp_phone?: string | null
    whatsapp_ever_connected?: boolean | null
}

export function hasAgentConnectedBefore(agent: AgentStatusLike): boolean {
    return agent.whatsapp_ever_connected === true || agent.whatsapp_connected === true || !!agent.whatsapp_phone
}

export function getAgentOperationalStatus(agent: AgentStatusLike): AgentOperationalStatus {
    if (agent.is_active === false) {
        return 'paused'
    }

    if (agent.whatsapp_connected) {
        return 'connected'
    }

    if (hasAgentConnectedBefore(agent)) {
        return 'reconnect_required'
    }

    return 'qr_ready'
}

export function getAgentOperationalLabel(status: AgentOperationalStatus): string {
    switch (status) {
        case 'paused':
            return 'Desactive'
        case 'connected':
            return 'Connecte'
        case 'reconnect_required':
            return 'A reconnecter'
        case 'qr_ready':
        default:
            return 'A connecter'
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

    switch (status) {
        case 'connected':
            return agent.whatsapp_phone || 'WhatsApp connecte'
        case 'reconnect_required':
            return 'Connexion WhatsApp perdue'
        case 'paused':
            return 'Agent desactive'
        case 'qr_ready':
        default:
            return 'Premiere connexion en attente'
    }
}
