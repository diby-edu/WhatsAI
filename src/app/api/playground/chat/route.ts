import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    try {
        const { agentId, message, conversationHistory } = await request.json()

        if (!agentId || !message) {
            return errorResponse('Agent et message requis', 400)
        }

        // Fetch agent
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name, system_prompt, personality, model')
            .eq('id', agentId)
            .eq('user_id', user.id)
            .single()

        if (agentError || !agent) {
            return errorResponse('Agent non trouvé', 404)
        }

        // Check user credits
        const { data: profile } = await supabase
            .from('profiles')
            .select('credits_balance')
            .eq('id', user.id)
            .single()

        if (!profile || profile.credits_balance < 1) {
            return errorResponse('Crédits insuffisants', 402)
        }

        // Build messages for OpenAI
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: agent.system_prompt || `Tu es ${agent.name}, un assistant IA serviable.`
            }
        ]

        // Add conversation history
        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory.slice(-10)) { // Last 10 messages
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    })
                }
            }
        }

        // Add current message
        messages.push({
            role: 'user',
            content: message
        })

        // Call OpenAI
        const completion = await openai.chat.completions.create({
            model: agent.model || 'gpt-3.5-turbo',
            messages,
            temperature: 0.7,
            max_tokens: 500
        })

        const response = completion.choices[0]?.message?.content || 'Je n\'ai pas pu générer de réponse.'

        // Deduct 1 credit
        await supabase
            .from('profiles')
            .update({ credits_balance: profile.credits_balance - 1 })
            .eq('id', user.id)

        return successResponse({
            response,
            credits_remaining: profile.credits_balance - 1
        })

    } catch (err) {
        console.error('Playground chat error:', err)
        return errorResponse('Erreur lors de la génération de la réponse', 500)
    }
}
