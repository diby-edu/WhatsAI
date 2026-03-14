import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { getOpenAIClient } from '@/lib/ai/openai'
import OpenAI from 'openai'
import { getAIRuntimeSettings } from '@/lib/admin/settings'

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorise', 401)
    }

    const identifier = getClientIdentifier(request, user.id)
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.ai)

    if (!rateLimit.success) {
        return rateLimitResponse(rateLimit.resetTime)
    }

    try {
        const { agentId, message, conversationHistory } = await request.json()
        const aiDefaults = await getAIRuntimeSettings(createAdminClient())

        if (!agentId || !message) {
            return errorResponse('Agent et message requis', 400)
        }

        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, name, system_prompt, personality, model')
            .eq('id', agentId)
            .eq('user_id', user.id)
            .single()

        if (agentError || !agent) {
            return errorResponse('Agent non trouve', 404)
        }

        const { data: newBalance, error: creditError } = await supabase
            .rpc('deduct_credits', { p_user_id: user.id, p_amount: 1 })

        if (creditError) {
            console.error('Credit deduction error:', creditError)
            return errorResponse('Erreur de debit de credits', 500)
        }

        if (newBalance === -1) {
            return errorResponse('Credits insuffisants', 402)
        }

        if (newBalance === -2) {
            return errorResponse('Profil non trouve', 404)
        }

        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: agent.system_prompt || `Tu es ${agent.name}, un assistant IA serviable.`,
            },
        ]

        if (conversationHistory && Array.isArray(conversationHistory)) {
            for (const msg of conversationHistory.slice(-10)) {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({
                        role: msg.role,
                        content: msg.content,
                    })
                }
            }
        }

        messages.push({
            role: 'user',
            content: message,
        })

        const completion = await getOpenAIClient().chat.completions.create({
            model: agent.model || aiDefaults.openaiModel,
            messages,
            temperature: aiDefaults.temperatureDefault,
            max_tokens: aiDefaults.maxTokensPerMessage,
        })

        const response = completion.choices[0]?.message?.content || "Je n'ai pas pu generer de reponse."

        return successResponse({
            response,
            credits_remaining: typeof newBalance === 'number' && newBalance >= 0 ? newBalance : undefined,
        })
    } catch (err) {
        console.error('Playground chat error:', err)
        return errorResponse('Erreur lors de la generation de la reponse', 500)
    }
}
