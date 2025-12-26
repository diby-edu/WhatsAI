import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export interface AIMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface GenerateResponseOptions {
    model?: string
    temperature?: number
    maxTokens?: number
    systemPrompt: string
    conversationHistory: AIMessage[]
    userMessage: string
    agentName?: string
    useEmojis?: boolean
    language?: string
}

export interface AIResponse {
    content: string
    tokensUsed: number
    model: string
    responseTimeMs: number
}

/**
 * Generate an AI response for a WhatsApp conversation
 */
export async function generateAIResponse(
    options: GenerateResponseOptions
): Promise<AIResponse> {
    const startTime = Date.now()

    const {
        model = 'gpt-4o-mini',
        temperature = 0.7,
        maxTokens = 500,
        systemPrompt,
        conversationHistory,
        userMessage,
        agentName = 'Assistant',
        useEmojis = true,
        language = 'fr',
    } = options

    // Build the system message
    const enhancedSystemPrompt = `${systemPrompt}

Instructions supplémentaires:
- Tu es ${agentName}, un assistant virtuel sur WhatsApp.
- Réponds de manière naturelle et conversationnelle.
- ${useEmojis ? 'Utilise des emojis de manière appropriée pour rendre la conversation plus chaleureuse.' : 'N\'utilise pas d\'emojis.'}
- Réponds principalement en ${language === 'fr' ? 'français' : language}.
- Garde tes réponses concises (adaptées à WhatsApp).
- Si tu ne peux pas aider avec quelque chose, suggère poliment de contacter un humain.`

    // Build messages array
    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: enhancedSystemPrompt },
        ...conversationHistory.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
        })),
        { role: 'user', content: userMessage },
    ]

    try {
        const completion = await openai.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
        })

        const responseContent = completion.choices[0]?.message?.content || ''
        const tokensUsed = completion.usage?.total_tokens || 0

        return {
            content: responseContent,
            tokensUsed,
            model,
            responseTimeMs: Date.now() - startTime,
        }
    } catch (error) {
        console.error('OpenAI API error:', error)
        throw error
    }
}

/**
 * Analyze a lead based on conversation
 */
export async function analyzeLeadQuality(
    conversationHistory: AIMessage[]
): Promise<{
    score: number // 0-100
    status: 'new' | 'qualified' | 'contacted' | 'negotiation' | 'converted' | 'lost'
    reasoning: string
}> {
    const analysisPrompt = `Analyse cette conversation WhatsApp et évalue la qualité du lead.
  
Réponds en JSON avec ce format exact:
{
  "score": <nombre de 0 à 100>,
  "status": "<new|qualified|contacted|negotiation|converted|lost>",
  "reasoning": "<explication courte>"
}

Critères d'évaluation:
- Intérêt exprimé pour le produit/service
- Questions posées sur les prix
- Demande de rendez-vous ou de démo
- Urgence du besoin
- Budget mentionné`

    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: analysisPrompt },
        ...conversationHistory.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
        })),
    ]

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.3,
            max_tokens: 200,
            response_format: { type: 'json_object' },
        })

        const response = JSON.parse(completion.choices[0]?.message?.content || '{}')

        return {
            score: response.score || 0,
            status: response.status || 'new',
            reasoning: response.reasoning || '',
        }
    } catch (error) {
        console.error('Lead analysis error:', error)
        return {
            score: 0,
            status: 'new',
            reasoning: 'Analyse non disponible',
        }
    }
}

/**
 * Extract key information from a conversation
 */
export async function extractContactInfo(
    conversationHistory: AIMessage[]
): Promise<{
    name?: string
    email?: string
    phone?: string
    company?: string
    interest?: string
}> {
    const extractionPrompt = `Extrais les informations de contact de cette conversation.
  
Réponds en JSON avec ce format:
{
  "name": "<nom si mentionné ou null>",
  "email": "<email si mentionné ou null>",
  "phone": "<téléphone si mentionné ou null>",
  "company": "<entreprise si mentionnée ou null>",
  "interest": "<ce qui intéresse le contact ou null>"
}`

    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: extractionPrompt },
        ...conversationHistory.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
        })),
    ]

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.1,
            max_tokens: 150,
            response_format: { type: 'json_object' },
        })

        return JSON.parse(completion.choices[0]?.message?.content || '{}')
    } catch (error) {
        console.error('Contact extraction error:', error)
        return {}
    }
}

/**
 * Generate a welcome message based on agent personality
 */
export async function generateWelcomeMessage(
    agentName: string,
    personality: 'professional' | 'friendly' | 'casual' | 'formal',
    businessDescription: string
): Promise<string> {
    const personalityGuide = {
        professional: 'Sois professionnel et efficace, inspire confiance.',
        friendly: 'Sois chaleureux et amical, utilise des emojis.',
        casual: 'Sois décontracté et naturel, comme un ami.',
        formal: 'Sois formel et respectueux, très poli.',
    }

    const prompt = `Génère un court message de bienvenue WhatsApp pour ${agentName}.
  
Contexte de l'entreprise: ${businessDescription}
Style: ${personalityGuide[personality]}

Le message doit:
- Saluer le visiteur
- Se présenter brièvement
- Proposer de l'aide
- Être adapté à WhatsApp (court, max 3-4 phrases)`

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 150,
        })

        return completion.choices[0]?.message?.content || 'Bonjour ! Comment puis-je vous aider ? 👋'
    } catch (error) {
        console.error('Welcome message generation error:', error)
        return 'Bonjour ! Comment puis-je vous aider ? 👋'
    }
}
