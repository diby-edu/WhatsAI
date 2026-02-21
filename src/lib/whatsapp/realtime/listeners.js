/**
 * Supabase Realtime Listeners
 * Remplace le polling agressif par des WebSockets
 *
 * CPU: 55% constant -> ~5% au repos
 * Latence: 0-2s (polling) -> ~100ms (push)
 */

// Set pour éviter les doublons (idempotency)
const processingMessages = new Set()
const processingOutbound = new Set()

// Stockage pour reconnexion
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 5000

/**
 * Configure les listeners Realtime pour les 3 tables critiques
 * @param {Object} context - Context avec supabase, activeSessions, etc.
 * @returns {Object} Channels créés pour cleanup éventuel
 */
function setupRealtimeListeners(context) {
    const { supabase, activeSessions, pendingConnections } = context

    console.log('📡 Initializing Supabase Realtime listeners...')

    // ═══════════════════════════════════════════════════════════
    // CHANNEL 1: Messages pending (réponses IA)
    // ═══════════════════════════════════════════════════════════
    const messagesChannel = supabase
        .channel('pending-messages')
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: 'status=eq.pending'
            },
            async (payload) => {
                if (payload.new.role !== 'assistant') return
                console.log('⚡ [REALTIME] New pending message detected:', payload.new.id)
                await handlePendingMessage(context, payload.new)
            }
        )
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: 'status=eq.pending'
            },
            async (payload) => {
                if (payload.new.role !== 'assistant') return
                // Évite de retraiter un message déjà en cours
                if (processingMessages.has(payload.new.id)) return
                await handlePendingMessage(context, payload.new)
            }
        )
        .subscribe((status, err) => {
            console.log(`📡 Messages channel status: ${status}`)
            if (err) console.error('📡 Messages channel error:', err)
            if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
                console.log('⚠️ Messages channel failed, will retry via backup polling')
            }
            if (status === 'SUBSCRIBED') {
                reconnectAttempts = 0
                console.log('✅ Messages channel connected successfully')
            }
        })

    // ═══════════════════════════════════════════════════════════
    // CHANNEL 2: Outbound messages (notifications standalone)
    // ═══════════════════════════════════════════════════════════
    const outboundChannel = supabase
        .channel('outbound-messages')
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'outbound_messages',
                filter: 'status=eq.pending'
            },
            async (payload) => {
                console.log('⚡ [REALTIME] New outbound message:', payload.new.id)
                await handleOutboundMessage(context, payload.new)
            }
        )
        .subscribe((status, err) => {
            console.log(`📡 Outbound channel status: ${status}`)
            if (err) console.error('📡 Outbound channel error:', err)
            if (status === 'SUBSCRIBED') {
                console.log('✅ Outbound channel connected successfully')
            }
        })

    // ═══════════════════════════════════════════════════════════
    // CHANNEL 3: Agents (connexion demandée)
    // ═══════════════════════════════════════════════════════════
    const agentsChannel = supabase
        .channel('agent-status')
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'agents',
                filter: 'whatsapp_status=eq.connecting'
            },
            async (payload) => {
                console.log('⚡ [REALTIME] Agent requesting connection:', payload.new.name)
                // Déclencher initSession si pas déjà actif
                const { initSession } = require('../handlers/session')
                if (!activeSessions.has(payload.new.id) && !pendingConnections.has(payload.new.id)) {
                    initSession(context, payload.new.id, payload.new.name)
                }
            }
        )
        .subscribe((status, err) => {
            console.log(`📡 Agents channel status: ${status}`)
            if (err) console.error('📡 Agents channel error:', err)
            if (status === 'SUBSCRIBED') {
                console.log('✅ Agents channel connected successfully')
            }
        })

    console.log('✅ Realtime listeners initialized')
    return { messagesChannel, outboundChannel, agentsChannel }
}

// ═══════════════════════════════════════════════════════════
// HANDLER: Message pending
// ═══════════════════════════════════════════════════════════
async function handlePendingMessage(context, message) {
    const { supabase, activeSessions } = context

    // Idempotency check
    if (processingMessages.has(message.id)) {
        console.log(`⏭️ [REALTIME] Message ${message.id} already processing, skipping`)
        return
    }
    processingMessages.add(message.id)

    try {
        // Récupérer la conversation
        const { data: conv } = await supabase
            .from('conversations')
            .select('contact_phone, contact_jid, agent_id, bot_paused')
            .eq('id', message.conversation_id)
            .single()

        if (!conv) {
            console.log(`⚠️ [REALTIME] Conversation not found for message ${message.id}`)
            return
        }

        if (conv.bot_paused) {
            console.log(`⏸️ [REALTIME] Bot paused for conversation, skipping`)
            return
        }

        const session = activeSessions.get(conv.agent_id)
        if (!session?.socket) {
            console.log(`⚠️ [REALTIME] Agent ${conv.agent_id} offline, backup polling will handle`)
            return
        }

        // Construire le JID
        let jid = conv.contact_jid || conv.contact_phone
        if (!jid.includes('@')) {
            const isLid = conv.contact_phone.length > 15 || !/^\d{10,13}$/.test(conv.contact_phone)
            jid = conv.contact_phone + (isLid ? '@lid' : '@s.whatsapp.net')
        }

        console.log(`   📍 Phone: ${conv.contact_phone}`)
        console.log(`   📍 JID: ${jid}`)

        // Envoyer le message
        const result = await session.socket.sendMessage(jid, { text: message.content })

        // Marquer comme envoyé
        await supabase.from('messages')
            .update({
                status: 'sent',
                whatsapp_message_id: result.key.id
            })
            .eq('id', message.id)

        // Mettre à jour conversation
        await supabase.from('conversations').update({
            last_message_text: message.content.substring(0, 200),
            last_message_at: new Date().toISOString(),
            last_message_role: 'assistant'
        }).eq('id', message.conversation_id)

        console.log(`✅ [REALTIME] Message sent to ${conv.contact_phone}`)

    } catch (error) {
        console.error('❌ [REALTIME] Error sending message:', error)
        await supabase.from('messages')
            .update({ status: 'failed', error_message: error.message })
            .eq('id', message.id)
    } finally {
        processingMessages.delete(message.id)
    }
}

// ═══════════════════════════════════════════════════════════
// HANDLER: Outbound message
// ═══════════════════════════════════════════════════════════
async function handleOutboundMessage(context, msg) {
    const { supabase, activeSessions } = context

    // Idempotency check
    if (processingOutbound.has(msg.id)) {
        console.log(`⏭️ [REALTIME] Outbound ${msg.id} already processing, skipping`)
        return
    }
    processingOutbound.add(msg.id)

    try {
        const session = activeSessions.get(msg.agent_id)
        if (!session?.socket) {
            console.log(`⚠️ [REALTIME] Agent ${msg.agent_id} offline for outbound`)
            return
        }

        let jid = msg.recipient_phone
        if (!jid.includes('@')) {
            jid = jid.replace(/\D/g, '') + '@s.whatsapp.net'
        }

        console.log(`   📨 [OUTBOUND] Processing message for ${msg.recipient_phone}`)
        console.log(`   📍 JID: ${jid}`)

        await session.socket.sendMessage(jid, { text: msg.message_content })

        await supabase.from('outbound_messages')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', msg.id)

        console.log(`✅ [REALTIME] Outbound sent to ${msg.recipient_phone}`)

    } catch (error) {
        console.error('❌ [REALTIME] Outbound error:', error)
        await supabase.from('outbound_messages')
            .update({ status: 'failed', error_log: error.message })
            .eq('id', msg.id)
    } finally {
        processingOutbound.delete(msg.id)
    }
}

/**
 * Nettoie les channels Realtime (pour graceful shutdown)
 * @param {Object} channels - Channels retournés par setupRealtimeListeners
 * @param {Object} supabase - Client Supabase
 */
async function cleanupRealtimeListeners(channels, supabase) {
    console.log('📴 Cleaning up Realtime listeners...')
    if (channels.messagesChannel) {
        await supabase.removeChannel(channels.messagesChannel)
    }
    if (channels.outboundChannel) {
        await supabase.removeChannel(channels.outboundChannel)
    }
    if (channels.agentsChannel) {
        await supabase.removeChannel(channels.agentsChannel)
    }
    console.log('✅ Realtime listeners cleaned up')
}

module.exports = { setupRealtimeListeners, cleanupRealtimeListeners }
