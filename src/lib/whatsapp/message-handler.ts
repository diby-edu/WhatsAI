import { createAdminClient } from '@/lib/api-utils'
import { generateAIResponse, analyzeLeadQuality, AIMessage } from '@/lib/ai/openai'
import { sendMessageWithTyping, WhatsAppMessage, setMessageHandler } from '@/lib/whatsapp/baileys'

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
                console.log('Agent not found or inactive:', agentId)
                return
            }

            // Get or create conversation
            const phoneNumber = message.from.replace('@s.whatsapp.net', '')

            let { data: conversation } = await supabase
                .from('conversations')
                .select('id')
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
                    })
                    .select('id')
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
                console.error('Failed to create/get conversation')
                return
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

            // Get conversation history for context
            const { data: messages } = await supabase
                .from('messages')
                .select('role, content')
                .eq('conversation_id', conversation.id)
                .order('created_at', { ascending: true })
                .limit(20) // Last 20 messages for context

            const conversationHistory: AIMessage[] = (messages || []).map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }))

            // Check user credits
            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_balance, credits_used_this_month')
                .eq('id', agent.user_id)
                .single()

            if (!profile || profile.credits_balance <= 0) {
                console.log('User has no credits left')
                // Optionally send a message about low credits
                return
            }

            // Generate AI response
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
            })

            // Send the response via WhatsApp
            const sendResult = await sendMessageWithTyping(
                agentId,
                message.from,
                aiResponse.content,
                (agent.response_delay_seconds || 2) * 1000
            )

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
            await supabase
                .from('profiles')
                .update({
                    credits_balance: profile.credits_balance - 1,
                    credits_used_this_month: (profile.credits_used_this_month || 0) + 1,
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
}
