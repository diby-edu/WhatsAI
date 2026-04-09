const { MessagingService } = require('../services/messaging.service')

// Compteur horaire des broadcasts par agent (in-memory, reset auto)
const broadcastHourlyCount = new Map() // agentId -> { count, windowStart }
const BROADCAST_HOURLY_LIMIT = 50
const BROADCAST_DELAY_MIN = 3000  // 3s
const BROADCAST_DELAY_MAX = 8000  // 8s

function getBroadcastCount(agentId) {
    const now = Date.now()
    const entry = broadcastHourlyCount.get(agentId)
    if (!entry || now - entry.windowStart >= 3600000) {
        broadcastHourlyCount.set(agentId, { count: 0, windowStart: now })
        return 0
    }
    return entry.count
}

function incrementBroadcastCount(agentId) {
    const entry = broadcastHourlyCount.get(agentId) || { count: 0, windowStart: Date.now() }
    entry.count++
    broadcastHourlyCount.set(agentId, entry)
}

function broadcastDelay() {
    return BROADCAST_DELAY_MIN + Math.random() * (BROADCAST_DELAY_MAX - BROADCAST_DELAY_MIN)
}

async function getAgentIsActive(supabase, agentId, cache) {
    if (cache.has(agentId)) return cache.get(agentId)

    const { data, error } = await supabase
        .from('agents')
        .select('is_active')
        .eq('id', agentId)
        .maybeSingle()

    const isActive = !error && !!data?.is_active
    cache.set(agentId, isActive)
    return isActive
}

const ONE_HOUR = 60 * 60 * 1000

function resolveJid(contactJid, phoneNumber) {
    if (contactJid?.includes('@')) return contactJid
    const base = contactJid || phoneNumber
    if (base.includes('@')) return base
    const isLid = phoneNumber.length > 15 || !/^\d{10,13}$/.test(phoneNumber)
    return phoneNumber + (isLid ? '@lid' : '@s.whatsapp.net')
}

async function simulateTyping(socket, jid, text) {
    try {
        const delay = 1000 + Math.min(text.length * 30, 1000)
        await socket.sendPresenceUpdate('composing', jid)
        await new Promise(resolve => setTimeout(resolve, delay))
        await socket.sendPresenceUpdate('paused', jid)
    } catch { /* ne pas bloquer l'envoi */ }
}

async function handleHistorySendError(supabase, msg, error) {
    console.error(`Failed to send pending message to ${msg.conversation.contact_phone}:`, error)
    const ageMs = Date.now() - new Date(msg.created_at).getTime()
    if (ageMs > ONE_HOUR) {
        await supabase.from('messages')
            .update({ status: 'failed', error_message: `Abandon après 1h: ${error.message}` })
            .eq('id', msg.id)
        console.error(`History message ${msg.id} abandonné après 1h`)
    } else {
        console.log(`History message ${msg.id} restera pending (âge: ${Math.round(ageMs / 60000)}min)`)
    }
}

async function sendHistoryMessage(supabase, session, msg) {
    const jid = resolveJid(msg.conversation.contact_jid, msg.conversation.contact_phone)
    await simulateTyping(session.socket, jid, msg.content)
    const result = await session.socket.sendMessage(jid, { text: msg.content })
    await supabase.from('messages')
        .update({ status: 'sent', whatsapp_message_id: result.key.id })
        .eq('id', msg.id)
    await supabase.from('conversations').update({
        last_message_text: msg.content.substring(0, 200),
        last_message_at: new Date().toISOString(),
        last_message_role: 'assistant'
    }).eq('id', msg.conversation_id)
}

async function processHistoryMessage(supabase, activeSessions, agentStateCache, msg) {
    const agentId = msg.conversation.agent_id
    const isManualResponse = msg?.metadata?.manual_response === true
    const isActive = await getAgentIsActive(supabase, agentId, agentStateCache)
    if (!isActive) {
        await supabase.from('messages')
            .update({ status: 'failed', error_message: 'agent_inactive' })
            .eq('id', msg.id)
        return
    }
    // Ne pas envoyer si la conversation est en pause (humain a pris la main)
    const conversationBlocked =
        msg.conversation.bot_paused === true ||
        msg.conversation.status === 'escalated' ||
        msg.conversation.status === 'spam'

    if (conversationBlocked && !isManualResponse) {
        console.log(`⏸️ [HISTORY] Skipping pending msg ${msg.id}: conversation ${msg.conversation_id} is bot_paused`)
        return
    }
    const session = activeSessions.get(agentId)
    if (!session?.socket) return
    try {
        await sendHistoryMessage(supabase, session, msg)
    } catch (sendError) {
        await handleHistorySendError(supabase, msg, sendError)
    }
}

// CHECK PENDING MESSAGES (Hybrid Solution: History)
async function checkPendingHistoryMessages(context) {
    const { supabase, activeSessions } = context
    const agentStateCache = new Map()
    try {
        const { data: pendingMessages } = await supabase
            .from('messages')
            .select(`*, conversation:conversations!inner(contact_phone, contact_jid, agent_id, bot_paused, status)`)
            .eq('status', 'pending')
            .eq('role', 'assistant')
            .limit(10)

        if (!pendingMessages?.length) return 0
        console.log(`Found ${pendingMessages.length} pending assistant messages (History)`)
        for (const msg of pendingMessages) {
            await processHistoryMessage(supabase, activeSessions, agentStateCache, msg)
        }
        return pendingMessages.length
    } catch (error) {
        console.error('Error checking pending history messages:', error)
        return 0
    }
}

// OUTBOUND — helpers

async function markOutboundFailed(supabase, msgId, reason) {
    await supabase.from('outbound_messages')
        .update({ status: 'failed', error_log: reason })
        .eq('id', msgId)
}

async function handleOutboundSendError(supabase, msg, sendError) {
    console.error(`Failed to send outbound to ${msg.recipient_phone}:`, sendError)
    const ageMs = Date.now() - new Date(msg.created_at).getTime()
    if (ageMs > ONE_HOUR) {
        await markOutboundFailed(supabase, msg.id, `Abandon après 1h: ${sendError.message}`)
        console.error(`Outbound ${msg.id} abandonné après 1h`)
    } else {
        console.log(`Outbound ${msg.id} restera pending (âge: ${Math.round(ageMs / 60000)}min) — retry au prochain cycle`)
    }
}

async function sendOutboundMessage(supabase, session, msg) {
    let jid = msg.recipient_phone
    if (!jid.includes('@')) jid = jid.replaceAll(/\D/gu, '') + '@s.whatsapp.net'

    await new Promise(resolve => setTimeout(resolve, broadcastDelay()))

    if (msg.media_url && msg.media_type === 'document') {
        const fileName = decodeURIComponent(msg.media_url.split('/').pop()?.split('?')[0] || 'fichier')
        await MessagingService.sendDocument(session, jid, msg.media_url, fileName, msg.message_content)
    } else if (msg.media_url && msg.media_type === 'image') {
        await MessagingService.sendImage(session, jid, msg.media_url, msg.message_content)
    } else {
        await session.socket.sendMessage(jid, { text: msg.message_content })
    }

    incrementBroadcastCount(msg.agent_id)
    await supabase.from('outbound_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', msg.id)
}

async function processOutboundMessage(supabase, activeSessions, agentStateCache, msg) {
    const isActive = await getAgentIsActive(supabase, msg.agent_id, agentStateCache)
    if (!isActive) {
        await markOutboundFailed(supabase, msg.id, 'agent_inactive')
        return
    }

    const session = activeSessions.get(msg.agent_id)
    if (!session?.socket || !session.socket.user) {
        console.log(`Agent ${msg.agent_id} socket not ready (disconnected or QR pending), keeping in queue`)
        return
    }

    const hourlyCount = getBroadcastCount(msg.agent_id)
    if (hourlyCount >= BROADCAST_HOURLY_LIMIT) {
        console.log(`Broadcast limit reached for agent ${msg.agent_id} (${hourlyCount}/h) — retry next cycle`)
        return
    }

    try {
        await sendOutboundMessage(supabase, session, msg)
    } catch (sendError) {
        await handleOutboundSendError(supabase, msg, sendError)
    }
}

// OUTBOUND MESSAGE QUEUE PROCESSING (Standalone)
async function checkOutboundMessages(context) {
    const { supabase, activeSessions } = context
    const agentStateCache = new Map()

    try {
        const { data: messages, error } = await supabase
            .from('outbound_messages')
            .select('*')
            .eq('status', 'pending')
            .limit(10)

        if (error) {
            if (error.code === '42P01') return 0
            console.error('Error checking outbound messages:', error)
            return 0
        }

        if (!messages?.length) return 0
        console.log(`Found ${messages.length} pending outbound messages`)
        for (const msg of messages) {
            await processOutboundMessage(supabase, activeSessions, agentStateCache, msg)
        }
        return messages.length
    } catch (e) {
        console.error('Error checking outbound messages:', e)
        return 0
    }
}

module.exports = { checkPendingHistoryMessages, checkOutboundMessages }
