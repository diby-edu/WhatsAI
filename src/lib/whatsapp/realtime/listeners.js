/**
 * Supabase Realtime Listeners
 * Version 1.0.3 - Consolidated Adaptive Solution
 */

const processingMessages = new Set()
const processingOutbound = new Set()

/**
 * Configure les listeners Realtime pour toutes les tables critiques via un CANAL UNIQUE
 * @param {Object} context - Context avec supabase, activeSessions, etc.
 * @returns {Object} Channel unique créé
 */
function setupRealtimeListeners(context) {
    const { supabase, activeSessions, pendingConnections } = context

    // Initialiser l'état de connexion dans le contexte
    context.realtimeConnected = false
    let reconnectAttempts = 0 // Initialize reconnectAttempts

    console.log(`📡 [REALTIME] Establishing consolidated channel 'whatsapp-updates'...`)

    // ═══════════════════════════════════════════════════════════
    // CANAL UNIQUE : Réduit la charge de handshake sur le VPS
    // ═══════════════════════════════════════════════════════════
    const messagesChannel = supabase
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
            console.log(`📡 [REALTIME] Attempting subscription... Status: ${status}`)
            if (err) {
                console.error('📡 [REALTIME] Handshake Error:', err.message)
                context.realtimeConnected = false
            }
            if (status === 'SUBSCRIBED') {
                console.log('✅ [REALTIME] Connection established and authenticated!')
                context.realtimeConnected = true
                reconnectAttempts = 0
            } else if (status === 'TIMED_OUT') {
                console.error('⚠️ [REALTIME] Handshake timed out - Network is likely blocking long-lived SSL tunnels (IPv6/MTU issues).')
                context.realtimeConnected = false
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                context.realtimeConnected = false
                console.log('⚠️ [REALTIME] Connection failed/closed. Adaptive polling activated (15s).')
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

async function cleanupRealtimeListeners(channel, supabase) {
    console.log('📴 [REALTIME] Cleaning up...')
    if (channel) {
        await supabase.removeChannel(channel)
    }
    console.log('✅ [REALTIME] Done')
}

module.exports = { setupRealtimeListeners, cleanupRealtimeListeners }
