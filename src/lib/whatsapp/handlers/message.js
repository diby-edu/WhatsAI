const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { transcribeAudio } = require('../utils/audio')
const { analyzeSentiment } = require('../ai/sentiment')
const { generateAIResponse } = require('../ai/generator')

async function handleMessage(context, agentId, message, isVoiceMessage = false) {
    const { openai, supabase, activeSessions, CinetPay } = context

    try {
        // 1. Check if conversation is escalated/paused
        // Get or create conversation context
        let { data: conversation } = await supabase
            .from('conversations')
            .select('*')
            .eq('agent_id', agentId)
            .eq('contact_phone', message.from)
            .single()

        if (conversation) {
            if (conversation.status === 'escalated' || conversation.bot_paused) {
                console.log('Skipping message: conversation escalated or bot paused')
                return
            }
        }

        // Get Agent Details
        const { data: agent } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single()

        if (!agent) {
            console.error('Agent not found:', agentId)
            return
        }

        // Get User/Profile for credits check
        const { data: profile } = await supabase
            .from('profiles')
            .select('credits_balance, credits_used_this_month')
            .eq('id', agent.user_id)
            .single()

        if (!profile || profile.credits_balance <= 0) {
            console.log('⚠️ Insufficient credits for agent owner:', agent.user_id)
            return
        }

        // Ensure conversation exists
        if (!conversation) {
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .insert({
                    agent_id: agentId,
                    user_id: agent.user_id,
                    contact_phone: message.from,
                    status: 'active',
                    metadata: {
                        wa_name: message.pushName
                    }
                })
                .select()
                .single()

            if (createError || !newConv) {
                console.error('❌ Failed to create conversation:', createError)
                return
            }
            conversation = newConv
        }

        if (!conversation || !conversation.id) {
            console.error('❌ Critical: Invalid conversation object', conversation)
            return
        }

        // 2. Store User Message
        const { error: msgError } = await supabase.from('messages').insert({
            conversation_id: conversation.id,
            agent_id: agentId,
            role: 'user',
            content: message.text || (isVoiceMessage ? '[Voice Message]' : '[Image]'),
            whatsapp_message_id: message.key.id,
            status: 'received',
            metadata: {
                is_voice: isVoiceMessage,
                has_media: !!message.imageMessage
            }
        })

        if (msgError) console.error('Error saving message:', msgError)

        // 3. Transcribe Audio if voice message
        if (isVoiceMessage && message.audioMessage) {
            console.log('🎤 Processing Voice Method...')
            try {
                // Download audio buffer
                const buffer = await downloadMediaMessage(
                    message,
                    'buffer',
                    { logger: console }
                )

                // Transcribe
                const transcription = await transcribeAudio(openai, buffer)
                console.log('📝 Transcription:', transcription)

                // Update message text
                message.text = transcription

                // Update DB message with transcription
                await supabase.from('messages')
                    .update({
                        content: transcription,
                        metadata: { is_voice: true, transcription_status: 'success' }
                    })
                    .eq('whatsapp_message_id', message.key.id)

            } catch (err) {
                console.error('Transcription failed:', err)
                message.text = " [Message vocal incompréhensible] "
            }
        }

        // Handle Image input (Vision)
        if (message.imageMessage) {
            console.log('📸 Image received, downloading...')
            try {
                const buffer = await downloadMediaMessage(
                    message,
                    'buffer',
                    { logger: console }
                )
                // Convert to base64
                const imageBase64 = buffer.toString('base64')
                message.imageBase64 = imageBase64
                message.text = message.text || (message.caption ? message.caption : "Que penses-tu de cette image ?")
            } catch (uploadErr) {
                console.error('Screenshot processing error:', uploadErr)
            }
        }

        // Get conversation history
        const { data: messages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: true })
            .limit(20)

        // Get products - CRITICAL: Filter by agent_id, not user_id!
        const { data: products } = await supabase
            .from('products')
            // FETCH ALL FIELDS (including pitch, tags, GPS...)
            .select('*')
            .eq('agent_id', agentId)  // FIX: Filter by agent, not user
            .eq('is_available', true)
            .limit(20)

        // DEBUG: Log product variants
        if (products && products.length > 0) {
            console.log('📦 Products loaded:', products.length)
            products.forEach(p => {
                if (p.variants && p.variants.length > 0) {
                    console.log(`   ${p.name}:`, JSON.stringify(p.variants))
                }
            })
        }

        // Get recent orders for this customer (Context Injection + Smart Reuse)
        const { data: orders } = await supabase
            .from('orders')
            .select(`
                id,
                status,
                total_fcfa,
                created_at,
                customer_phone,
                delivery_address,
                items:order_items(product_name, quantity)
            `)
            .eq('user_id', agent.user_id)
            .eq('customer_phone', message.from) // Clean match?
            .order('created_at', { ascending: false })
            .limit(5)

        // 🧠 SENTIMENT ANALYSIS (Phase 15)
        const sentimentAnalysis = await analyzeSentiment(openai, message.text)
        console.log('❤️ Sentiment:', sentimentAnalysis)

        if (sentimentAnalysis.sentiment === 'angry' || sentimentAnalysis.sentiment === 'negative' && sentimentAnalysis.is_urgent) {
            console.log('🚨 ANGRY CUSTOMER DETECTED - ESCALATING')

            // 1. Mark conversation as escalated
            await supabase.from('conversations')
                .update({ status: 'escalated', bot_paused: true })
                .eq('id', conversation.id)

            // 2. Send Handover Message (more human-friendly + escalation number)
            let handoverMessage = "Je comprends votre frustration et je m'en excuse sincèrement. 🙏\n\nJe transfère immédiatement votre dossier à un conseiller humain qui va vous contacter très rapidement."

            // Add escalation phone if configured
            if (agent.escalation_phone) {
                handoverMessage += `\n\n📞 Vous pouvez aussi appeler directement : ${agent.escalation_phone}`
            }

            const session = activeSessions.get(agentId)
            if (session) {
                await session.socket.sendMessage(message.from, { text: handoverMessage })
                await supabase.from('messages').insert({
                    conversation_id: conversation.id,
                    agent_id: agentId,
                    role: 'assistant',
                    content: handoverMessage,
                    status: 'sent'
                })
            }
            return // Stop AI
        }

        // Generate AI response
        console.log('🧠 Generating AI response...')
        let profileCurrency = 'USD'
        try {
            const { data: userProfile } = await supabase.from('profiles').select('currency').eq('id', agent.user_id).single()
            if (userProfile?.currency) profileCurrency = userProfile.currency
        } catch (e) { }

        const aiResponse = await generateAIResponse({
            agent, // Pass the full agent object
            conversationHistory: (messages || []).slice(0, -1).map(m => ({ role: m.role, content: m.content })),
            userMessage: message.text,
            imageBase64: message.imageBase64, // Pass image to AI
            products: products || [],
            currency: profileCurrency,
            orders: orders || [],
            customerPhone: message.from, // FIX: Pass full JID instead of stripped phone
            conversationId: conversation.id // ✅ PASS CONVERSATION ID (Critical for hard link)
        }, {
            openai,
            supabase,
            activeSessions,
            CinetPay
        })
        const session = activeSessions.get(agentId)
        if (session && session.socket) {
            const delay = (agent.response_delay_seconds || 2) * 1000

            // Simulate typing
            await session.socket.presenceSubscribe(message.from)
            await session.socket.sendPresenceUpdate('composing', message.from)
            await new Promise(r => setTimeout(r, delay))
            await session.socket.sendPresenceUpdate('paused', message.from)

            // Determine if we should send Voice or Text
            let result;
            // COST OPTIMIZATION: Only send voice if ENABLED + CREDITS + INCOMING WAS VOICE
            const shouldSendVoice = agent.enable_voice_responses && (profile.credits_balance >= 5) && isVoiceMessage
            let sentVoice = false

            if (shouldSendVoice) {
                console.log('🗣️ Voice response enabled, generating audio...')
                try {
                    const mp3 = await openai.audio.speech.create({
                        model: "tts-1",
                        voice: agent.voice_id || 'alloy',
                        input: aiResponse.content,
                    });

                    const buffer = Buffer.from(await mp3.arrayBuffer());

                    // Send audio (ptt = true for voice note)
                    result = await session.socket.sendMessage(message.from, {
                        audio: buffer,
                        mimetype: 'audio/mp4',
                        ptt: true
                    })
                    sentVoice = true
                    console.log('✅ Voice message sent')
                } catch (voiceErr) {
                    console.error('❌ Voice gen failed, falling back to text:', voiceErr)
                }
            } else if (agent.enable_voice_responses && profile.credits_balance < 5) {
                console.log('⚠️ Voice skipped: Insufficient credits (< 5)')
            }

            // If Voice was NOT sent (either disabled, failed, or no credits), send Text
            if (!sentVoice) {
                // Send TEXT message (link preview disabled to prevent crashes with payment URLs)
                result = await session.socket.sendMessage(message.from, {
                    text: aiResponse.content
                }, {
                    linkPreview: false  // FIX: Disable to prevent crash with payment URLs
                })
                console.log('📤 Text Response sent:', result.key.id)
            }

            // Calculate cost
            const creditsToDeduct = sentVoice ? 5 : 1

            // Save response
            await supabase.from('messages').insert({
                conversation_id: conversation.id,
                agent_id: agentId,
                role: 'assistant',
                content: aiResponse.content,
                whatsapp_message_id: result.key.id,
                tokens_used: aiResponse.tokensUsed,
                status: 'sent'
            })

            // Deduct credit
            await supabase.from('profiles').update({
                credits_balance: profile.credits_balance - creditsToDeduct,
                credits_used_this_month: (profile.credits_used_this_month || 0) + creditsToDeduct
            }).eq('id', agent.user_id)

            // Update agent stats
            await supabase.from('agents').update({
                total_messages: (agent.total_messages || 0) + 2
            }).eq('id', agentId)
        }
    } catch (error) {
        console.error('Error handling message:', error)
    }
}

module.exports = { handleMessage }
