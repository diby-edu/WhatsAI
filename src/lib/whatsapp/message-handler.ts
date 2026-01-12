import { createAdminClient } from '@/lib/api-utils'
import { generateAIResponse, analyzeLeadQuality, AIMessage, transcribeAudio, generateSpeech } from '@/lib/ai/openai'
import { sendMessageWithTyping, WhatsAppMessage, setMessageHandler, downloadMedia, sendAudioMessage } from '@/lib/whatsapp/baileys'

/**
 * Main message handler that processes incoming WhatsApp messages
 * This should be called when the server starts to register the handler
 */
export function initializeMessageHandler() {
    setMessageHandler(async (agentId: string, message: WhatsAppMessage) => {
        console.log(`Received message for agent ${agentId}:`, message.message)

        const supabase = createAdminClient()

        try {
            // Get agent configuration
            const { data: agent, error: agentError } = await supabase
                .from('agents')
                .select('*')
                .eq('id', agentId)
                .single()

            if (agentError || !agent || !agent.is_active) {
                console.log('❌ Agent not found or inactive:', agentId, agentError)
                return
            }
            console.log('✅ Agent found:', agent.name)

            // OPTIONAL: Transcribe audio if incoming message is audio
            if (message.messageType === 'audio' && (message as any).rawMessage) {
                console.log('🎤 Receiving audio message, starting transcription...')
                try {
                    const buffer = await downloadMedia((message as any).rawMessage)
                    const transcription = await transcribeAudio(buffer)
                    if (transcription) {
                        console.log('📝 Transcription success:', transcription)
                        // Update message content so it is saved and used by AI as text
                        message.message = `[Message Vocal: ${transcription}]`
                    } else {
                        message.message = '[Message Vocal: (Transcription impossible)]'
                    }
                } catch (err) {
                    console.error('❌ Transcription failed:', err)
                    message.message = '[Message Vocal: (Erreur lecture)]'
                }
            }

            // OPTIONAL: Vision handling (Image)
            const inputImageUrls: string[] = []
            if (message.messageType === 'image' && (message as any).rawMessage) {
                console.log('📸 Receiving image message, downloading...')
                try {
                    const buffer = await downloadMedia((message as any).rawMessage)
                    if (buffer) {
                        const base64Image = buffer.toString('base64')
                        const dataUrl = `data:image/jpeg;base64,${base64Image}`
                        inputImageUrls.push(dataUrl)
                        console.log('✅ Image processed for Vision AI')
                        // Update message content for history context
                        if (!message.message || message.message === '') {
                            message.message = '[Image envoyée]'
                        }
                    }
                } catch (err) {
                    console.error('❌ Failed to process image:', err)
                }
            }

            // Get or create conversation
            // Clean phone number from all WhatsApp suffixes
            const phoneNumber = message.from
                .replace('@s.whatsapp.net', '')
                .replace('@lid', '')
                .replace('@g.us', '')

            let { data: conversation } = await supabase
                .from('conversations')
                .select('id, bot_paused')
                .eq('agent_id', agentId)
                .eq('contact_phone', phoneNumber)
                .single()

            if (!conversation) {
                const { data: newConv } = await supabase
                    .from('conversations')
                    .insert({
                        agent_id: agentId,
                        user_id: agent.user_id,
                        contact_phone: phoneNumber,
                        contact_push_name: message.pushName,
                        status: 'active',
                        bot_paused: false
                    })
                    .select('id, bot_paused')
                    .single()
                conversation = newConv
            } else {
                // Update push name if available
                if (message.pushName) {
                    await supabase
                        .from('conversations')
                        .update({ contact_push_name: message.pushName })
                        .eq('id', conversation.id)
                }
            }

            if (!conversation) {
                console.error('❌ Failed to create/get conversation')
                return
            }
            console.log('✅ Conversation ID:', conversation.id)

            // Check if bot is paused (human takeover)
            const isBotPaused = (conversation as any).bot_paused === true
            if (isBotPaused) {
                console.log('⏸️ Bot is paused for this conversation - skipping AI response')
            }

            // Save incoming message
            await supabase
                .from('messages')
                .insert({
                    conversation_id: conversation.id,
                    agent_id: agentId,
                    role: 'user',
                    content: message.message,
                    whatsapp_message_id: message.messageId,
                    message_type: message.messageType,
                    status: 'read',
                })

            // If bot is paused, stop here - don't generate AI response
            if (isBotPaused) {
                console.log('📩 Message saved but bot is paused - no AI response will be sent')
                return
            }

            // Get conversation history for context
            const { data: messages } = await supabase
                .from('messages')
                .select('role, content')
                .eq('conversation_id', conversation.id)
                .order('created_at', { ascending: true })
                .limit(50) // Last 50 messages for context

            const conversationHistory: AIMessage[] = (messages || []).map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }))

            // Check user credits and currency
            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_balance, credits_used_this_month, currency')
                .eq('id', agent.user_id)
                .single()

            if (!profile || profile.credits_balance <= 0) {
                console.log('❌ User has no credits left - balance:', profile?.credits_balance)
                // Optionally send a message about low credits
                return
            }
            console.log('✅ Credits OK:', profile.credits_balance, '| Currency:', profile.currency || 'XOF')

            // Fetch products for the user (to include in AI context)
            const { data: products } = await supabase
                .from('products')
                .select('name, price_fcfa, description, product_type, ai_instructions, lead_fields, stock_quantity, short_pitch, marketing_tags, features, variants, related_product_ids')
                .eq('user_id', agent.user_id)
                .eq('is_available', true)
                .limit(100)

            console.log(`📦 Found ${products?.length || 0} products for AI context`)

            // Generate AI response
            console.log('🧠 Generating AI response...')
            const aiResponse = await generateAIResponse({
                model: agent.model || 'gpt-4o-mini',
                temperature: agent.temperature || 0.7,
                maxTokens: agent.max_tokens || 500,
                systemPrompt: agent.system_prompt,
                conversationHistory: conversationHistory.slice(0, -1), // Exclude current message
                userMessage: message.message,
                agentName: agent.name,
                useEmojis: agent.use_emojis,
                language: agent.language || 'fr',
                products: (products || []) as any,
                // GPS & Location
                businessAddress: agent.business_address,
                businessHours: agent.business_hours,
                latitude: agent.latitude,
                longitude: agent.longitude,
                inputImageUrls: inputImageUrls,
                // Currency for product pricing
                currency: profile.currency || 'XOF'
            })
            console.log('✅ AI Response generated:', aiResponse.content.substring(0, 100), '...')

            // Check for Tool Calls (Reservations)
            if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
                console.log('🛠️ Handling tool calls:', aiResponse.toolCalls.length)

                for (const toolCall of aiResponse.toolCalls) {
                    const func = (toolCall as any).function

                    if (func.name === 'create_booking') {
                        const args = JSON.parse(func.arguments)
                        console.log('📅 Creating booking:', args)

                        const { data: booking, error: bookingError } = await supabase
                            .from('bookings')
                            .insert({
                                agent_id: agentId,
                                customer_phone: message.from,
                                booking_type: args.booking_type,
                                start_time: args.start_time,
                                party_size: args.party_size || 1,
                                notes: args.notes,
                                status: 'confirmed'
                            })
                            .select()
                            .single()

                        const toolOutput = bookingError
                            ? `Erreur lors de la réservation: ${bookingError.message}`
                            : `Réservation confirmée avec succès (ID: ${booking ? booking.id.substring(0, 8) : '?'}).`

                        const newHistory = [
                            ...conversationHistory.slice(0, -1),
                            { role: 'user', content: message.message },
                            { role: 'assistant', content: aiResponse.content, tool_calls: aiResponse.toolCalls },
                            { role: 'tool', tool_call_id: toolCall.id, content: toolOutput }
                        ]

                        const finalAiResponse = await generateAIResponse({
                            model: agent.model || 'gpt-4o-mini',
                            temperature: agent.temperature || 0.7,
                            maxTokens: 150,
                            systemPrompt: agent.system_prompt,
                            conversationHistory: newHistory as any[],
                            userMessage: "Confirme la réservation au client.",
                            agentName: agent.name,
                            useEmojis: agent.use_emojis,
                            language: agent.language || 'fr',
                            businessAddress: agent.business_address,
                            businessHours: agent.business_hours,
                            latitude: agent.latitude,
                            longitude: agent.longitude
                        })

                        aiResponse.content = finalAiResponse.content

                    } else if (func.name === 'create_order') {
                        const args = JSON.parse(func.arguments)
                        console.log('🛒 Creating order:', args)

                        let total = 0
                        if (args.items && Array.isArray(args.items)) {
                            total = args.items.reduce((sum: number, item: any) => {
                                return sum + ((item.unit_price || 0) * item.quantity)
                            }, 0)
                        }

                        const { data: order, error: orderError } = await supabase
                            .from('orders')
                            .insert({
                                user_id: agent.user_id,
                                agent_id: agentId,
                                customer_phone: args.contact_phone || message.from,
                                customer_name: args.customer_name,
                                delivery_address: args.delivery_address,
                                notes: args.notes,
                                total_fcfa: total,
                                status: 'pending',
                                conversation_id: conversation.id
                            })
                            .select()
                            .single()

                        if (order && args.items) {
                            const orderItems = args.items.map((item: any) => ({
                                order_id: order.id,
                                product_name: item.product_name,
                                quantity: item.quantity,
                                unit_price_fcfa: item.unit_price || 0
                            }))
                            await supabase.from('order_items').insert(orderItems)
                        }

                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://whatsai.duckdns.org'
                        const paymentLink = order ? `${baseUrl}/fr/pay/${order.id}` : ''

                        const toolOutput = orderError
                            ? `Erreur commande: ${orderError.message}`
                            : `Commande enregistrée (ID: ${order ? order.id.substring(0, 8) : '?'}, Total: ${total}).\nLIEN DE PAIEMENT SÉCURISÉ : ${paymentLink}\n\nINSTRUCTION : Partage ce lien EXACT au client pour qu'il règle la commande via CinetPay.`

                        const newHistory = [
                            ...conversationHistory.slice(0, -1),
                            { role: 'user', content: message.message },
                            { role: 'assistant', content: aiResponse.content, tool_calls: aiResponse.toolCalls },
                            { role: 'tool', tool_call_id: toolCall.id, content: toolOutput }
                        ]

                        const finalAiResponse = await generateAIResponse({
                            model: agent.model || 'gpt-4o-mini',
                            temperature: agent.temperature || 0.7,
                            maxTokens: 150,
                            systemPrompt: agent.system_prompt,
                            conversationHistory: newHistory as any[],
                            userMessage: "Confirme la commande au client.",
                            agentName: agent.name,
                            useEmojis: agent.use_emojis,
                            language: agent.language || 'fr',
                            businessAddress: agent.business_address,
                            businessHours: agent.business_hours,
                            latitude: agent.latitude,
                            longitude: agent.longitude
                        })

                        aiResponse.content = finalAiResponse.content
                    }
                }
            }

            // Send the response via WhatsApp (Text)
            console.log('📤 Sending text message via WhatsApp to:', message.from)
            const sendResult = await sendMessageWithTyping(
                agentId,
                message.from,
                aiResponse.content,
                (agent.response_delay_seconds || 2) * 1000
            )
            console.log('📤 Text result:', sendResult.success ? '✅ SUCCESS' : '❌ FAILED', sendResult)

            // OPTIONAL: Send Voice Response (Premium)
            // Check if user has enough credits (needs 5 total: 1 base + 4 voice)
            let voiceSent = false
            const hasVoiceCredits = profile.credits_balance >= 5

            if (agent.enable_voice_responses && sendResult.success) {
                if (hasVoiceCredits) {
                    console.log('🗣️ Voice response enabled, generating audio...')
                    try {
                        // Generate audio
                        const audioBuffer = await generateSpeech(aiResponse.content, agent.voice_id || 'alloy')

                        // Send audio note
                        const voiceResult = await sendAudioMessage(agentId, message.from, audioBuffer)

                        if (voiceResult.success) {
                            voiceSent = true
                            console.log('✅ Voice message sent successfully')
                        }
                    } catch (voiceErr) {
                        console.error('❌ Failed to generate/send voice:', voiceErr)
                    }
                } else {
                    console.log('⚠️ Voice response skipped: Insufficient credits (< 5)')
                }
            }

            // Save AI response to database
            await supabase
                .from('messages')
                .insert({
                    conversation_id: conversation.id,
                    agent_id: agentId,
                    role: 'assistant',
                    content: aiResponse.content,
                    whatsapp_message_id: sendResult.messageId,
                    tokens_used: aiResponse.tokensUsed,
                    response_time_ms: aiResponse.responseTimeMs,
                    model_used: aiResponse.model,
                    status: sendResult.success ? 'sent' : 'failed',
                })

            // Deduct credits
            // Base cost = 1. Voice cost = +4 (Total 5).
            const creditsToDeduct = voiceSent ? 5 : 1

            await supabase
                .from('profiles')
                .update({
                    credits_balance: profile.credits_balance - creditsToDeduct,
                    credits_used_this_month: (profile.credits_used_this_month || 0) + creditsToDeduct,
                })
                .eq('id', agent.user_id)

            // Update agent stats
            await supabase
                .from('agents')
                .update({
                    total_messages: (agent.total_messages || 0) + 2, // Incoming + outgoing
                })
                .eq('id', agentId)

            // Analyze lead quality every 5 messages
            if ((messages?.length || 0) % 5 === 0) {
                const leadAnalysis = await analyzeLeadQuality(conversationHistory)
                await supabase
                    .from('conversations')
                    .update({
                        lead_status: leadAnalysis.status,
                        lead_score: leadAnalysis.score,
                        lead_notes: leadAnalysis.reasoning,
                    })
                    .eq('id', conversation.id)
            }

            console.log(`Response sent for conversation ${conversation.id}`)
        } catch (error) {
            console.error('Error handling message:', error)
        }
    })

    console.log('WhatsApp message handler initialized')

    // Restore sessions for all active agents
    restoreSessions()
}

async function restoreSessions() {
    console.log('🔄 Restoring WhatsApp sessions...')
    const supabase = createAdminClient()
    const { hasStoredSession, initWhatsAppSession } = await import('@/lib/whatsapp/baileys')

    try {
        const { data: agents, error } = await supabase
            .from('agents')
            .select('id, name')
            .eq('is_active', true)
            .eq('whatsapp_connected', true)

        if (error) {
            console.error('Error fetching agents for restoration:', error)
            return
        }

        console.log(`Found ${agents?.length || 0} active agents to check`)

        for (const agent of agents || []) {
            if (hasStoredSession(agent.id)) {
                console.log(`Restoring session for agent ${agent.name} (${agent.id})...`)
                try {
                    await initWhatsAppSession(agent.id)
                    console.log(`✅ Session restored for ${agent.name}`)
                } catch (err) {
                    console.error(`❌ Failed to restore session for ${agent.name}:`, err)
                }
            } else {
                console.log(`No stored session found for ${agent.name}`)
            }
        }
    } catch (err) {
        console.error('Critical error in session restoration:', err)
    }
}
