/**
 * Supabase Realtime Listeners
 * Version 1.1.0 - Dual-Client Architecture (anon_key for Realtime)
 *
 * FIX CRITIQUE: Supabase Realtime rejette service_role_key pour postgres_changes
 * Solution: utiliser anon_key via supabaseRealtime, garder service_role pour DB ops
 */

const { MessagingService } = require('../services/messaging.service')
const { resolveCanonicalJid } = require('../utils/jid')
const { processingMessages, processingOutbound } = require('../utils/queue-processing-state')

async function simulateRealtimeTyping(socket, jid, text) {
    try {
        const delay = 800 + Math.min((text || '').length * 25, 1200)
        await socket.sendPresenceUpdate('composing', jid)
        await new Promise((resolve) => setTimeout(resolve, delay))
        await socket.sendPresenceUpdate('paused', jid)
    } catch {
        // Le typing indicator ne doit jamais bloquer l'envoi.
    }
}

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
 * Configure les listeners Realtime pour toutes les tables critiques via un canal unique.
 * @param {Object} context
 * @returns {Object}
 */
function setupRealtimeListeners(context) {
    const { supabaseRealtime, activeSessions, pendingConnections } = context

    context.realtimeConnected = false

    console.log('[REALTIME] Establishing channel with anon_key...')

    const messagesChannel = supabaseRealtime
        .channel('whatsapp-updates', {
            config: {
                presence: { key: 'bot' },
                broadcast: { ack: true },
            },
        })
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: 'role=eq.assistant',
            },
            async (payload) => {
                if (payload.new.status !== 'pending') return
                console.log('[REALTIME] Status: Processing new message', payload.new.id)
                await handlePendingMessage(context, payload.new)
            }
        )
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'outbound_messages' },
            async (payload) => {
                if (payload.new.status !== 'pending') return
                console.log('[REALTIME] Outbound message detected:', payload.new.id)
                await handleOutboundMessage(context, payload.new)
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'agents' },
            async (payload) => {
                const { whatsapp_status, whatsapp_connected, name, id, is_active } = payload.new

                if (is_active === false) {
                    const session = activeSessions.get(id)
                    if (session) {
                        console.log(`[REALTIME] Agent deactivated - closing orphan socket (${id})`)
                        try { session.socket.end() } catch (_) { }
                        activeSessions.delete(id)
                    }
                    pendingConnections.delete(id)
                    return
                }

                if (whatsapp_connected === false && whatsapp_status === 'disconnected') {
                    const session = activeSessions.get(id)
                    if (session) {
                        console.log(`[REALTIME] WhatsApp disconnected - closing orphan socket (${id})`)
                        try { session.socket.end() } catch (_) { }
                        activeSessions.delete(id)
                    }
                    pendingConnections.delete(id)
                    return
                }

                if (whatsapp_status !== 'connecting') return

                console.log('[REALTIME] Agent connection requested:', name)
                const { initSession } = require('../handlers/session')
                const existingSession = activeSessions.get(id)
                if (existingSession && !pendingConnections.has(id)) {
                    console.log(`[REALTIME] Recycling existing socket before reconnect (${id})`)
                    try { existingSession.socket.end() } catch (_) { }
                    activeSessions.delete(id)
                }

                if (pendingConnections.has(id)) return

                if (typeof context.scheduleSessionInit === 'function') {
                    context.scheduleSessionInit(context, { id, name, whatsapp_status }, 99)
                } else {
                    initSession(context, id, name, 99)
                }
            }
        )
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'agents' }, (payload) => {
            const agentId = payload.old?.id
            if (!agentId) return
            const session = activeSessions.get(agentId)
            if (session) {
                console.log(`[REALTIME] Agent deleted - closing orphan socket (${agentId})`)
                try { session.socket.end() } catch (_) { }
                activeSessions.delete(agentId)
            }
            pendingConnections.delete(agentId)
        })
        .subscribe((status, err) => {
            if (err) {
                console.error('[REALTIME] Error:', err.message || err)
                context.realtimeConnected = false
            }
            if (status === 'SUBSCRIBED') {
                console.log('[REALTIME] Connected')
                context.realtimeConnected = true
            } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                console.log(`[REALTIME] ${status} - Fallback polling active`)
                context.realtimeConnected = false
            }
        }, 90000)

    console.log('[REALTIME] Master listener registered')
    return messagesChannel
}

async function handlePendingMessage(context, message) {
    const { supabase, activeSessions } = context
    if (processingMessages.has(message.id)) return
    processingMessages.add(message.id)

    try {
        const isManualResponse = message?.metadata?.manual_response === true
        const { data: conv } = await supabase
            .from('conversations')
            .select('contact_phone, contact_jid, agent_id, bot_paused, status')
            .eq('id', message.conversation_id)
            .single()

        const conversationBlocked =
            conv?.bot_paused === true ||
            conv?.status === 'escalated' ||
            conv?.status === 'spam'

        if (!conv || (conversationBlocked && !isManualResponse)) return

        const agentActive = await isAgentActive(supabase, conv.agent_id)
        if (!agentActive) {
            await supabase.from('messages')
                .update({ status: 'failed', error_message: 'agent_inactive' })
                .eq('id', message.id)
            return
        }

        const session = activeSessions.get(conv.agent_id)
        if (!session?.socket || !session.socket.user) return

        const target = await resolveCanonicalJid(
            session.socket,
            conv.contact_phone,
            conv.contact_jid
        )
        const jid = target.jid

        await simulateRealtimeTyping(session.socket, jid, message.content)
        const result = await session.socket.sendMessage(jid, { text: message.content })

        await supabase.from('messages')
            .update({ status: 'sent', whatsapp_message_id: result.key.id })
            .eq('id', message.id)

        await supabase.from('conversations').update({
            last_message_text: message.content.substring(0, 200),
            last_message_at: new Date().toISOString(),
            last_message_role: 'assistant',
        }).eq('id', message.conversation_id)

        console.log(`[REALTIME] Message accepted for ${conv.contact_phone} via ${jid} (${target.source}) as ${result?.key?.id || 'unknown-id'}`)
    } catch (error) {
        console.error('[REALTIME] Send error:', error.message)
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
                .update({ status: 'failed' })
                .eq('id', msg.id)
            return
        }

        const session = activeSessions.get(msg.agent_id)
        if (!session?.socket || !session.socket.user) return

        const target = await resolveCanonicalJid(session.socket, msg.recipient_phone)
        const jid = target.jid
        console.log(`[REALTIME] Attempting outbound send ${msg.id} via ${jid} (${target.source})`)

        let result = null
        if (msg.media_url && msg.media_type === 'document') {
            const fileName = decodeURIComponent(msg.media_url.split('/').pop()?.split('?')[0] || 'fichier')
            result = await MessagingService.sendDocument(session, jid, msg.media_url, fileName, msg.message_content)
        } else if (msg.media_url && msg.media_type === 'image') {
            result = await MessagingService.sendImage(session, jid, msg.media_url, msg.message_content)
        } else {
            result = await session.socket.sendMessage(jid, { text: msg.message_content })
        }

        await supabase.from('outbound_messages')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', msg.id)

        console.log(`[REALTIME] Outbound accepted for ${msg.recipient_phone} via ${jid} (${target.source}) as ${result?.key?.id || 'unknown-id'}`)
    } catch (error) {
        console.error('[REALTIME] Outbound error:', error.message)
        await supabase.from('outbound_messages')
            .update({ status: 'failed' })
            .eq('id', msg.id)
    } finally {
        processingOutbound.delete(msg.id)
    }
}

async function cleanupRealtimeListeners(channel, supabaseRealtime) {
    console.log('[REALTIME] Cleaning up...')
    if (channel && supabaseRealtime) {
        await supabaseRealtime.removeChannel(channel)
    }
    console.log('[REALTIME] Done')
}

module.exports = { setupRealtimeListeners, cleanupRealtimeListeners }
