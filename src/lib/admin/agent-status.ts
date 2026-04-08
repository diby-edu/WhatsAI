export type AgentOperationalStatus = 'paused' | 'connected' | 'connecting' | 'qr_ready' | 'reconnect_required'

export interface AgentStatusLike {
    is_active?: boolean | null
    whatsapp_connected?: boolean | null
    whatsapp_status?: string | null
    whatsapp_phone?: string | null
    whatsapp_ever_connected?: boolean | null
    whatsapp_disconnected_by?: string | null
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

    const rawStatus = String(agent.whatsapp_status || '').trim().toLowerCase()

    if (rawStatus === 'connecting') {
        return 'connecting'
    }

    if (rawStatus === 'qr_ready') {
        return 'qr_ready'
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
        case 'connecting':
            return 'Connexion...'
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
        case 'connecting':
            return {
                badgeBg: 'rgba(59, 130, 246, 0.15)',
                badgeText: '#60a5fa',
                iconBg: 'linear-gradient(135deg, #3b82f6, #2563eb)',
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
    const disconnectedBy = String(agent.whatsapp_disconnected_by || '').trim().toLowerCase()
    const connectedBefore = hasAgentConnectedBefore(agent)

    switch (status) {
        case 'connected':
            return agent.whatsapp_phone || 'WhatsApp connecte'
        case 'connecting':
            return connectedBefore ? 'Reconnexion WhatsApp en cours' : 'Connexion WhatsApp en cours'
        case 'qr_ready':
            return connectedBefore ? 'QR pret pour reconnexion' : 'Premiere connexion en attente'
        case 'reconnect_required':
            if (disconnectedBy === 'user') {
                return 'WhatsApp deconnecte manuellement'
            }
            return 'Connexion WhatsApp perdue'
        case 'paused':
            return 'Agent desactive'
        default:
            return 'Premiere connexion en attente'
    }
}
