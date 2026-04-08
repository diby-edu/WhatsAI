import { hasAgentConnectedBefore, type AgentStatusLike } from '@/lib/admin/agent-status'

type AgentLifecycleLike = AgentStatusLike & {
    whatsapp_qr_code?: string | null
    whatsapp_disconnected_by?: 'user' | 'system' | null | string
}

export function shouldResumeWhatsAppAfterActivation(agent: AgentStatusLike | null | undefined): boolean {
    return agent?.is_active === false && hasAgentConnectedBefore(agent)
}

export function buildAgentDeactivationUpdate() {
    return {
        is_active: false,
        whatsapp_connected: false,
        whatsapp_status: 'disconnected',
        whatsapp_qr_code: null,
        whatsapp_disconnected_by: null,
    }
}

export function buildAgentReactivationUpdate(agent: AgentLifecycleLike | null | undefined) {
    const updates: Record<string, unknown> = {
        is_active: true,
    }

    if (shouldResumeWhatsAppAfterActivation(agent)) {
        updates.whatsapp_connected = false
        updates.whatsapp_status = 'connecting'
        updates.whatsapp_qr_code = null
        updates.whatsapp_disconnected_by = null
    }

    return updates
}
