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

// CHECK PENDING MESSAGES (Hybrid Solution: History)
async function checkPendingHistoryMessages(context) {
    const { supabase, activeSessions } = context
    const agentStateCache = new Map()

    try {
        const { data: pendingMessages } = await supabase
            .from('messages')
            .select(`
                *,
                conversation:conversations!inner(
                    contact_phone,
                    contact_jid,
                    agent_id,
                    bot_paused
                )
            `)
            .eq('status', 'pending')
            .eq('role', 'assistant')
            .limit(10)

        if (pendingMessages && pendingMessages.length > 0) {
            console.log(`Found ${pendingMessages.length} pending assistant messages (History)`)

            for (const msg of pendingMessages) {
                const agentId = msg.conversation.agent_id
                const isActive = await getAgentIsActive(supabase, agentId, agentStateCache)

                if (!isActive) {
                    await supabase
                        .from('messages')
                        .update({ status: 'failed', error_message: 'agent_inactive' })
                        .eq('id', msg.id)
                    continue
                }

                const phoneNumber = msg.conversation.contact_phone
                const contactJid = msg.conversation.contact_jid
                const session = activeSessions.get(agentId)

                if (session && session.socket) {
                    try {
                        let jid = contactJid || phoneNumber
                        if (!jid.includes('@')) {
                            const isLid = phoneNumber.length > 15 || !/^\d{10,13}$/.test(phoneNumber)
                            jid = phoneNumber + (isLid ? '@lid' : '@s.whatsapp.net')
                        }

                        const result = await session.socket.sendMessage(jid, {
                            text: msg.content
                        })

                        await supabase
                            .from('messages')
                            .update({
                                status: 'sent',
                                whatsapp_message_id: result.key.id
                            })
                            .eq('id', msg.id)

                        await supabase.from('conversations').update({
                            last_message_text: msg.content.substring(0, 200),
                            last_message_at: new Date().toISOString(),
                            last_message_role: 'assistant'
                        }).eq('id', msg.conversation_id)
                    } catch (sendError) {
                        console.error(`Failed to send pending message to ${phoneNumber}:`, sendError)
                        // Même logique que outbound : retry pendant 1h, puis failed définitif
                        const ageMs = Date.now() - new Date(msg.created_at).getTime()
                        const ONE_HOUR = 60 * 60 * 1000
                        if (ageMs > ONE_HOUR) {
                            await supabase
                                .from('messages')
                                .update({ status: 'failed', error_message: `Abandon après 1h: ${sendError.message}` })
                                .eq('id', msg.id)
                            console.error(`History message ${msg.id} abandonné après 1h`)
                        } else {
                            console.log(`History message ${msg.id} restera pending (âge: ${Math.round(ageMs / 60000)}min) — retry au prochain cycle`)
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking pending history messages:', error)
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
            if (error.code === '42P01') return
            console.error('Error checking outbound messages:', error)
            return
        }

        if (messages && messages.length > 0) {
            console.log(`Found ${messages.length} pending outbound messages`)
            for (const msg of messages) {
                const isActive = await getAgentIsActive(supabase, msg.agent_id, agentStateCache)
                if (!isActive) {
                    await supabase.from('outbound_messages')
                        .update({ status: 'failed', error_log: 'agent_inactive' })
                        .eq('id', msg.id)
                    continue
                }

                const session = activeSessions.get(msg.agent_id)
                if (session && session.socket) {
                    // Limite horaire broadcast : 50 messages/heure par agent
                    const hourlyCount = getBroadcastCount(msg.agent_id)
                    if (hourlyCount >= BROADCAST_HOURLY_LIMIT) {
                        console.log(`⏳ Broadcast limit reached for agent ${msg.agent_id} (${hourlyCount}/h) — retry next cycle`)
                        continue
                    }

                    try {
                        let jid = msg.recipient_phone
                        if (!jid.includes('@')) jid = jid.replace(/\D/g, '') + '@s.whatsapp.net'

                        // Délai aléatoire anti-spam entre chaque message broadcast (3s–8s)
                        await new Promise(resolve => setTimeout(resolve, broadcastDelay()))

                        await session.socket.sendMessage(jid, {
                            text: msg.message_content
                        })

                        incrementBroadcastCount(msg.agent_id)

                        await supabase.from('outbound_messages')
                            .update({ status: 'sent', sent_at: new Date().toISOString() })
                            .eq('id', msg.id)
                    } catch (sendError) {
                        console.error(`Failed to send outbound to ${msg.recipient_phone}:`, sendError)

                        // Retry logic : laisser pending si message récent (< 1h)
                        // Le cron retentera automatiquement au prochain cycle.
                        // Après 1h sans succès → failed définitif.
                        const ageMs = Date.now() - new Date(msg.created_at).getTime()
                        const ONE_HOUR = 60 * 60 * 1000
                        if (ageMs > ONE_HOUR) {
                            await supabase.from('outbound_messages')
                                .update({ status: 'failed', error_log: `Abandon après 1h: ${sendError.message}` })
                                .eq('id', msg.id)
                            console.error(`Outbound ${msg.id} abandonné après 1h`)
                        } else {
                            console.log(`Outbound ${msg.id} restera pending (âge: ${Math.round(ageMs / 60000)}min) — retry au prochain cycle`)
                        }
                    }
                } else {
                    console.log(`Agent ${msg.agent_id} offline, keeping in queue`)
                }
            }
        }
    } catch (e) {
        console.error('Error checking outbound messages:', e)
    }
}

module.exports = { checkPendingHistoryMessages, checkOutboundMessages }
