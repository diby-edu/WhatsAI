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
    products?: Array<{
        name: string
        price_fcfa: number
        description: string | null
        product_type?: 'product' | 'service' | 'virtual'
        ai_instructions?: string | null
        lead_fields?: any[]
        stock_quantity?: number
        // Structure Fields
        short_pitch?: string | null
        features?: any
        marketing_tags?: string[] | null
        variants?: any
        related_products?: any
    }>
    currency?: string
    // GPS & Business Info
    businessAddress?: string | null
    businessHours?: any
    latitude?: number | null
    longitude?: number | null
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
        products = [],
        businessAddress,
        businessHours,
        latitude,
        longitude
    } = options

    // Build products catalog text
    let productsCatalog = ''
    if (products.length > 0) {
        productsCatalog = `\n\n🧠 CONTEXTE PRODUITS & SERVICES :
Tu as accès à la liste des produits/services vendus par l'entreprise.
Utilise ces informations pour guider le client.

LISTE DES OFFRES :
${products.map(p => {
            let specificRules = ''
            switch (p.product_type) {
                case 'virtual':
                    specificRules = '📧 PRODUIT VIRTUEL -> Demande l\'email du client. Ne demande JAMAIS d\'adresse de livraison.'
                    break
                case 'service':
                    specificRules = '🤝 SERVICE -> Propose de fixer un rendez-vous (Date/Heure). Ne parle pas de livraison.'
                    break
                case 'product':
                default:
                    specificRules = '📦 PRODUIT PHYSIQUE -> Vérifie le stock. Demande l\'adresse de livraison et la ville.'
                    break
            }

            const stockInfo = p.stock_quantity !== -1 ? `(Stock: ${p.stock_quantity})` : ''
            const customInstructions = p.ai_instructions ? `\n   ⚠️ NOTE VENDEUR : ${p.ai_instructions}` : ''

            // New Structured Info
            const pitch = p.short_pitch ? `\n   📢 PITCH : ${p.short_pitch}` : ''
            const tags = p.marketing_tags && p.marketing_tags.length > 0 ? `\n   🏷️ TAGS : ${p.marketing_tags.join(', ')}` : ''

            let featuresList = ''
            if (p.features && Array.isArray(p.features)) {
                featuresList = `\n   ✨ POINTS FORTS : ${p.features.map((f: any) => f.value).join(', ')}`
            }

            let variantsInfo = ''
            if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
                variantsInfo = `\n   🎨 VARIANTES DISPONIBLES : ${p.variants.map((v: any) => `${v.name} (${v.options.map((o: any) => o.name).join(', ')})`).join(' | ')}`
            }

            let displayPrice = p.price_fcfa
            let currencySymbol = '$'

            if (options.currency === 'XOF') {
                displayPrice = p.price_fcfa
                currencySymbol = 'FCFA'
            } else if (options.currency === 'EUR') {
                displayPrice = Math.round(p.price_fcfa * 0.92 * 100) / 100
                currencySymbol = '€'
            }

            return `🔹 ${p.name} - ${displayPrice.toLocaleString('fr-FR')} ${currencySymbol} ${stockInfo}
${pitch}${tags}${featuresList}${variantsInfo}
   📝 ${p.description || ''}
   RÈGLE : ${specificRules}${customInstructions}`
        }).join('\n\n')}

INSTRUCTION IMPORTANTE : 
Si le client s'intéresse à un produit, APPLIQUE STRICTEMENT la règle de son type (Virtuel vs Physique vs Service).`
    }


    // Build Location & Hours Context
    let locationContext = ''
    if (businessAddress || (latitude && longitude)) {
        locationContext += `\n📍 LOCALISATION & HORAIRES :`
        if (businessAddress) locationContext += `\n- Adresse : ${businessAddress}`
        if (latitude && longitude) {
            const mapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
            locationContext += `\n- Position GPS : ${latitude}, ${longitude}`
            locationContext += `\n- Lien Google Maps : ${mapsLink}`
            locationContext += `\n- INSTRUCTION : Si le client demande la localisation ou l'adresse, partage le lien Google Maps.`
        }
    }
    if (businessHours) {
        // Format hours if it's an object/json, otherwise use as string if simple
        const hoursText = typeof businessHours === 'string' ? businessHours : JSON.stringify(businessHours)
        locationContext += `\n- Horaires : ${hoursText}`
    }

    // Build the system message
    const enhancedSystemPrompt = `${systemPrompt}
${locationContext}

Instructions supplémentaires:
- Tu es ${agentName}, un assistant virtuel sur WhatsApp.
- Réponds de manière naturelle et conversationnelle.
- ${useEmojis ? 'Utilise des emojis de manière appropriée pour rendre la conversation plus chaleureuse.' : 'N\'utilise pas d\'emojis.'}
- Réponds principalement en ${language === 'fr' ? 'français' : language}.
- Garde tes réponses concises (adaptées à WhatsApp).
- Si tu ne peux pas aider avec quelque chose, suggère poliment de contacter un humain.${productsCatalog}`

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

/**
 * Transcribe audio file using OpenAI Whisper
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

/**
 * Transcribe audio file using OpenAI Whisper
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const tmpPath = path.join(os.tmpdir(), `audio-${Date.now()}.ogg`)

    try {
        // Write buffer to temp file
        fs.writeFileSync(tmpPath, audioBuffer)

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tmpPath),
            model: 'whisper-1',
            language: 'fr', // Optimisation for French
        })

        // Cleanup
        try { fs.unlinkSync(tmpPath) } catch { }

        return transcription.text
    } catch (error) {
        console.error('Whisper Transcription Error:', error)
        // Cleanup on error
        try { fs.unlinkSync(tmpPath) } catch { }
        return '' // Fail gracefully
    }
}

/**
 * Generate speech from text using OpenAI TTS
 */
export async function generateSpeech(
    text: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy'
): Promise<Buffer> {
    try {
        const mp3 = await openai.audio.speech.create({
            model: 'tts-1',
            voice: voice,
            input: text,
        })

        const buffer = Buffer.from(await mp3.arrayBuffer())
        return buffer
    } catch (error) {
        console.error('TTS Generation Error:', error)
        throw error
    }
}

/**
 * Generate embedding for text using OpenAI text-embedding-3-small
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text.replace(/\n/g, ' '),
        })
        return response.data[0].embedding
    } catch (error) {
        console.error('Embedding Generation Error:', error)
        throw error
    }
}
