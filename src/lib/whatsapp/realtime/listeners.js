/**
 * Supabase Realtime Listeners
 * Version 1.1.0 - Dual-Client Architecture (anon_key for Realtime)
 *
 * FIX CRITIQUE: Supabase Realtime REJETTE service_role_key pour postgres_changes
 * Solution: Utiliser anon_key via supabaseRealtime, garder service_role pour DB ops
 */

const processingMessages = new Set()
const processingOutbound = new Set()

async function isAgentActive(supabase, agentId) {
    const { data, error } = await supabase
        .from('agents')
        .select('is_active')
        .eq('id', agentId)
        .maybeSingle()

    if (error) {
        console.error('Failed to read agent state:', error.message)
        return false
    }

    return !!data?.is_active
}

/**
 * Configure les listeners Realtime pour toutes les tables critiques via un CANAL UNIQUE
 * @param {Object} context - Context avec supabase (admin), supabaseRealtime, activeSessions, etc.
 * @returns {Object} Channel unique créé
 */
function setupRealtimeListeners(context) {
    // supabaseRealtime = client avec anon_key (pour subscriptions)
    // supabase = client avec service_role_key (pour DB operations)
    const { supabaseRealtime, activeSessions, pendingConnections } = context

    context.realtimeConnected = false

    console.log(`📡 [REALTIME] Establishing channel with anon_key...`)

    // ═══════════════════════════════════════════════════════════
    // CANAL UNIQUE avec supabaseRealtime (anon_key)
    // ⚠️ service_role_key cause TIMED_OUT sur postgres_changes
    // ═══════════════════════════════════════════════════════════
    const messagesChannel = supabaseRealtime
        .channel('whatsapp-updates', {
            config: {
                presence: { key: 'bot' },
                broadcast: { ack: true }
            }
        })
        // 1. Messages (IA responses)
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: 'role=eq.assistant'
            },
            async (payload) => {
                if (payload.new.status !== 'pending') return
                console.log('⚡ [REALTIME] Status: Processing new message', payload.new.id)
                await handlePendingMessage(context, payload.new)
            }
        )
        // 2. Outbound (Standalone notifications)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'outbound_messages' }, async (payload) => {
            if (payload.new.status !== 'pending') return
            console.log('⚡ [REALTIME] Outbound message detected:', payload.new.id)
            await handleOutboundMessage(context, payload.new)
        })
        // 3. Agents (Connection requests)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agents' }, async (payload) => {
            const { whatsapp_status, name, id } = payload.new
            if (whatsapp_status !== 'connecting') return
            console.log('⚡ [REALTIME] Agent connection requested:', name)
            const { initSession } = require('../handlers/session')
            if (!activeSessions.has(id) && !pendingConnections.has(id)) {
                initSession(context, id, name)
            }
        })
        .subscribe((status, err) => {
            if (err) {
                console.error('📡 [REALTIME] Error:', err.message || err)
                context.realtimeConnected = false
            }
            if (status === 'SUBSCRIBED') {
                console.log('✅ [REALTIME] Connected!')
                context.realtimeConnected = true
            } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                console.log(`⚠️ [REALTIME] ${status} - Fallback polling active`)
                context.realtimeConnected = false
            }
        }, 90000)

    console.log('✅ [REALTIME] Master listener registered')
    return messagesChannel
}

// ═══════════════════════════════════════════════════════════
// HANDLERS (Idempotent)
// ═══════════════════════════════════════════════════════════

async function handlePendingMessage(context, message) {
    const { supabase, activeSessions } = context
    if (processingMessages.has(message.id)) return
    processingMessages.add(message.id)

    try {
        const { data: conv } = await supabase
            .from('conversations')
            .select('contact_phone, contact_jid, agent_id, bot_paused')
            .eq('id', message.conversation_id)
            .single()

        if (!conv || conv.bot_paused) return

        const agentActive = await isAgentActive(supabase, conv.agent_id)
        if (!agentActive) {
            await supabase.from('messages')
                .update({ status: 'failed', error_message: 'agent_inactive' })
                .eq('id', message.id)
            return
        }

        const session = activeSessions.get(conv.agent_id)
        if (!session?.socket) return

        let jid = conv.contact_jid || conv.contact_phone
        if (!jid.includes('@')) {
            const isLid = conv.contact_phone.length > 15 || !/^\d{10,13}$/.test(conv.contact_phone)
            jid = conv.contact_phone + (isLid ? '@lid' : '@s.whatsapp.net')
        }

        const result = await session.socket.sendMessage(jid, { text: message.content })

        await supabase.from('messages')
            .update({ status: 'sent', whatsapp_message_id: result.key.id })
            .eq('id', message.id)

        await supabase.from('conversations').update({
            last_message_text: message.content.substring(0, 200),
            last_message_at: new Date().toISOString(),
            last_message_role: 'assistant'
        }).eq('id', message.conversation_id)

        console.log(`✅ [REALTIME] Message delivered to ${conv.contact_phone}`)

    } catch (error) {
        console.error('❌ [REALTIME] Send error:', error.message)
        await supabase.from('messages')
            .update({ status: 'failed', error_message: error.message })
            .eq('id', message.id)
    } finally {
        processingMessages.delete(message.id)
    }
}

async function handleOutboundMessage(context, msg) {
    const { supabase, activeSessions } = context
    if (processingOutbound.has(msg.id)) return
    processingOutbound.add(msg.id)

    try {
        const agentActive = await isAgentActive(supabase, msg.agent_id)
        if (!agentActive) {
            await supabase.from('outbound_messages')
                .update({ status: 'failed', error_log: 'agent_inactive' })
                .eq('id', msg.id)
            return
        }

        const session = activeSessions.get(msg.agent_id)
        if (!session?.socket) return

        let jid = msg.recipient_phone
        if (!jid.includes('@')) jid = jid.replace(/\D/g, '') + '@s.whatsapp.net'

        await session.socket.sendMessage(jid, { text: msg.message_content })

        await supabase.from('outbound_messages')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', msg.id)

        console.log(`✅ [REALTIME] Outbound delivered to ${msg.recipient_phone}`)

    } catch (error) {
        console.error('❌ [REALTIME] Outbound error:', error.message)
        await supabase.from('outbound_messages')
            .update({ status: 'failed', error_log: error.message })
            .eq('id', msg.id)
    } finally {
        processingOutbound.delete(msg.id)
    }
}

async function cleanupRealtimeListeners(channel, supabaseRealtime) {
    console.log('📴 [REALTIME] Cleaning up...')
    if (channel && supabaseRealtime) {
        await supabaseRealtime.removeChannel(channel)
    }
    console.log('✅ [REALTIME] Done')
}

module.exports = { setupRealtimeListeners, cleanupRealtimeListeners }
