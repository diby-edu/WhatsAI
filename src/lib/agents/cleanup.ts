import { createAdminClient } from '@/lib/api-utils'

export async function clearStoredWhatsAppSession(adminSupabase: ReturnType<typeof createAdminClient>, agentId: string) {
    // Current production schema uses session_id (key-value store)
    const { error: bySessionIdError } = await adminSupabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', agentId)

    if (!bySessionIdError) return

    // Legacy schema fallback uses agent_id
    if (bySessionIdError.code === '42703') {
        const { error: byAgentIdError } = await adminSupabase
            .from('whatsapp_sessions')
            .delete()
            .eq('agent_id', agentId)

        if (byAgentIdError && byAgentIdError.code !== '42P01' && byAgentIdError.code !== '42703') {
            throw byAgentIdError
        }
        return
    }

    if (bySessionIdError.code !== '42P01') {
        throw bySessionIdError
    }
}

export async function cleanupAgentDependencies(adminSupabase: ReturnType<typeof createAdminClient>, agentId: string) {
    // This table exists in production schema and can block agent deletion (FK restriction)
    const { error: outboundError } = await adminSupabase
        .from('outbound_messages')
        .delete()
        .eq('agent_id', agentId)

    if (outboundError && outboundError.code !== '42P01') {
        throw outboundError
    }

    await clearStoredWhatsAppSession(adminSupabase, agentId)
}
