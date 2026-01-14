const { TOOLS, handleToolCall } = require('./tools')
const { findRelevantDocuments } = require('./rag')
const { verifyResponseIntegrity } = require('../utils/security')
const { buildAdaptiveSystemPrompt } = require('./prompt-builder')

/**
 * Generate AI Response
 * @param {Object} options Options object
 * @param {Object} dependencies { openai, supabase, activeSessions, CinetPay }
 * @returns {Promise<Object>} { content, tokensUsed }
 */
async function generateAIResponse(options, dependencies) {
    const { openai, supabase, activeSessions, CinetPay } = dependencies
    try {
        const {
            agent,
            conversationHistory,
            userMessage,
            products,
            orders,
            customerPhone,
            conversationId,
            currency = 'USD'
        } = options

        // Retrieve relevant knowledge (RAG)
        const relevantDocs = await findRelevantDocuments(openai, supabase, agent.id, userMessage)

        // Helper: Format Business Hours
        let formattedHours = 'Non spécifiés'
        if (agent.business_hours) {
            try {
                const hoursObj = typeof agent.business_hours === 'string'
                    ? JSON.parse(agent.business_hours)
                    : agent.business_hours

                const dayMap = {
                    monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
                    thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche'
                }

                formattedHours = Object.entries(hoursObj).map(([dayKey, schedule]) => {
                    const dayName = dayMap[dayKey] || dayKey
                    if (schedule.closed) return `${dayName}: Fermé`
                    return `${dayName}: ${schedule.open} - ${schedule.close}`
                }).join('\n  ')
            } catch (e) {
                formattedHours = String(agent.business_hours)
            }
        }

        const gpsLink = (agent.latitude && agent.longitude)
            ? `https://www.google.com/maps?q=${agent.latitude},${agent.longitude}`
            : ''

        const systemPrompt = buildAdaptiveSystemPrompt(
            agent,
            products || [],
            orders || [],
            relevantDocs || [],
            currency,
            gpsLink,
            formattedHours
        )

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-15)
        ]

        if (options.imageBase64) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: userMessage || "Que penses-tu de cette image ?" },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${options.imageBase64}`
                        }
                    }
                ]
            })
        } else {
            messages.push({ role: 'user', content: userMessage })
        }

        const modelToUse = options.imageBase64 ? 'gpt-4o' : (agent.model || 'gpt-4o-mini')

        const completion = await openai.chat.completions.create({
            model: modelToUse,
            messages,
            max_tokens: agent.max_tokens || 500,
            temperature: agent.temperature || 0.7,
            tools: TOOLS,
            tool_choice: 'auto'
        })

        const responseMessage = completion.choices[0].message
        let content = responseMessage.content

        if (responseMessage.tool_calls) {
            console.log('🤖 Model wants to call tools:', responseMessage.tool_calls.length)

            const newHistory = [
                ...messages,
                responseMessage
            ]

            for (const toolCall of responseMessage.tool_calls) {
                // Dependency Injection for handleToolCall
                const toolResult = await handleToolCall(
                    toolCall,
                    agent.id,
                    customerPhone,
                    products,
                    conversationId,
                    supabase,
                    activeSessions,
                    CinetPay
                )

                newHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            const secondCompletion = await openai.chat.completions.create({
                model: agent.model || 'gpt-4o-mini',
                messages: newHistory,
                max_tokens: agent.max_tokens || 500,
                temperature: agent.temperature || 0.7
            })

            content = secondCompletion.choices[0].message.content
        }

        const integrityCheck = verifyResponseIntegrity(content, products)
        if (!integrityCheck.isValid) {
            console.log('⚠️ Response integrity issues detected:', integrityCheck.issues)
        }

        return {
            content: content,
            tokensUsed: (completion.usage?.total_tokens || 0) + 100
        }
    } catch (error) {
        console.error('OpenAI error:', error)
        return { content: 'Désolé, je rencontre un problème technique. Veuillez réessayer.', tokensUsed: 0 }
    }
}

module.exports = { generateAIResponse }
