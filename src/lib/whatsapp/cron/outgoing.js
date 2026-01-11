// 📨 CHECK PENDING MESSAGES (Hybrid Solution: History)
async function checkPendingHistoryMessages(context) {
    const { supabase, activeSessions } = context
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
            .eq('role', 'assistant') // Only send assistant messages
            .limit(10)

        if (pendingMessages && pendingMessages.length > 0) {
            console.log(`💬 Found ${pendingMessages.length} pending assistant messages (History)`)

            for (const msg of pendingMessages) {
                const agentId = msg.conversation.agent_id
                const phoneNumber = msg.conversation.contact_phone
                const contactJid = msg.conversation.contact_jid // Full JID if available
                const session = activeSessions.get(agentId)

                if (session && session.socket) {
                    try {
                        // Use stored JID if available, otherwise construct from phone
                        let jid = contactJid || phoneNumber
                        if (!jid.includes('@')) {
                            // Detect LID (usually longer than 13 digits and doesn't look like a phone)
                            const isLid = phoneNumber.length > 15 || !/^\d{10,13}$/.test(phoneNumber)
                            jid = phoneNumber + (isLid ? '@lid' : '@s.whatsapp.net')
                        }

                        // 📊 DEBUG LOGS (Expert Recommendation)
                        console.log(`   📍 Phone: ${phoneNumber}`)
                        console.log(`   📍 JID: ${jid}`)
                        console.log(`   💾 Conversation ID: ${msg.conversation_id}`)

                        // Send message
                        const result = await session.socket.sendMessage(jid, {
                            text: msg.content
                        })

                        console.log(`✅ Message sent to ${phoneNumber} (History Updated)`)

                        // Update status to sent
                        await supabase
                            .from('messages')
                            .update({
                                status: 'sent',
                                whatsapp_message_id: result.key.id
                            })
                            .eq('id', msg.id)

                        // Update conversation last message (CRITICAL FOR UI)
                        await supabase.from('conversations').update({
                            last_message_text: msg.content.substring(0, 200),
                            last_message_at: new Date().toISOString(),
                            last_message_role: 'assistant'
                        }).eq('id', msg.conversation_id)

                    } catch (sendError) {
                        console.error(`❌ Failed to send pending message to ${phoneNumber}:`, sendError)
                        await supabase
                            .from('messages')
                            .update({ status: 'failed', error_message: sendError.message })
                            .eq('id', msg.id)
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking pending history messages:', error)
    }
}

// 📨 OUTBOUND MESSAGE QUEUE PROCESSING (Standalone)
async function checkOutboundMessages(context) {
    const { supabase, activeSessions } = context
    try {
        const { data: messages, error } = await supabase
            .from('outbound_messages')
            .select('*')
            .eq('status', 'pending')
            .limit(10)

        if (error) {
            // Table might not exist, skip silently
            if (error.code === '42P01') return
            console.error('Error checking outbound messages:', error)
            return
        }

        if (messages && messages.length > 0) {
            console.log(`📨 Found ${messages.length} pending outbound messages`)
            for (const msg of messages) {
                const session = activeSessions.get(msg.agent_id)
                if (session && session.socket) {
                    try {
                        let jid = msg.recipient_phone
                        if (!jid.includes('@')) jid = jid.replace(/\D/g, '') + '@s.whatsapp.net'

                        // 📊 DEBUG LOG (Expert Recommendation)
                        console.log(`   📨 [OUTBOUND] Processing message for ${msg.recipient_phone}`)
                        console.log(`   📍 JID: ${jid}`)

                        // Send text message
                        await session.socket.sendMessage(jid, {
                            text: msg.message_content
                        })
                        console.log(`✅ Outbound message sent to ${msg.recipient_phone}`)

                        // Mark as sent
                        await supabase.from('outbound_messages')
                            .update({ status: 'sent', sent_at: new Date().toISOString() })
                            .eq('id', msg.id)
                    } catch (sendError) {
                        console.error(`❌ Failed to send outbound to ${msg.recipient_phone}:`, sendError)
                        await supabase.from('outbound_messages')
                            .update({ status: 'failed', error_log: sendError.message })
                            .eq('id', msg.id)
                    }
                } else {
                    console.log(`⚠️ Agent ${msg.agent_id} offline, keeping in queue`)
                }
            }
        }
    } catch (e) {
        console.error('Error checking outbound messages:', e)
    }
}

module.exports = { checkPendingHistoryMessages, checkOutboundMessages }
