import OpenAI from 'openai'

// Lazy initialization for OpenAI client
let openaiInstance: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
    if (!openaiInstance) {
        if (!process.env.OPENAI_API_KEY) {
            console.warn('⚠️ OPENAI_API_KEY is not set. OpenAI features will fail at runtime.')
        }
        openaiInstance = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build', // Fallback for build time
        })
    }
    return openaiInstance
}

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
        image_url?: string | null
    }>
    currency?: string
    // GPS & Business Info
    businessAddress?: string | null
    businessHours?: any
    latitude?: number | null
    longitude?: number | null
    // Vision
    inputImageUrls?: string[]
}

export interface AIResponse {
    content: string
    tokensUsed: number
    model: string
    responseTimeMs: number
    toolCalls?: OpenAI.ChatCompletionMessageToolCall[]
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
        maxTokens = 300,
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
        longitude,
        inputImageUrls = []
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

            const imageUrl = p.image_url ? `\n   🖼️ IMAGE : ${p.image_url}` : ''

            return `🔹 ${p.name} - ${displayPrice.toLocaleString('fr-FR')} ${currencySymbol} ${stockInfo}
${pitch}${tags}${featuresList}${variantsInfo}${imageUrl}
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
- ${useEmojis ? 'Utilise des emojis pour être chaleureux.' : 'N\'utilise pas d\'emojis.'}
- Réponds principalement en ${language === 'fr' ? 'français' : language}.
- Si tu ne peux pas aider, suggère poliment de contacter un humain.

🔴 RÈGLES DE CONCISION (BUDGET OPTIMISATION) :
1. Sois poli mais DIRECT. Évite les phrases de remplissage.
2. 📸 VISION : Si le client envoie une image, analyse-la. Si c'est un produit que tu vends, confirme le stock.
3. 🖼️ IMAGES PRODUITS : Si tu parles d'un produit qui a une "IMAGE" dans ton catalogue, envoie le lien de l'image au client.
4. 🧾 RÉCAPITULATIF OBLIGATOIRE : Avant de demander le paiement ou la livraison, fais un RÉCAPITULATIF COMPLET (Articles + Prix Total + Frais). Demande confirmation ("C'est bon pour vous ?").
5. ✔️ CONFIRMATION PAIEMENT : Après paiement confirmé, le système enverra une notif. Toi, rassure juste sur la livraison.

🔧 OUTILS DISPONIBLES :
1. 'create_booking' : Pour les RÉSERVATIONS (Hôtel, Restaurant, Service).
2. 'create_order' : Pour les COMMANDES de produits physiques (Livraison, E-commerce).

RÈGLE D'OR : Dès que le client confirme ("Je prends ça", "Je réserve") APRÈS LE RÉCAPITULATIF, EXÉCUTE L'OUTIL CORRESPONDANT.${productsCatalog}`

    // Define Tools
    const tools: OpenAI.ChatCompletionTool[] = [
        {
            type: 'function',
            function: {
                name: 'create_booking',
                description: 'Enregistrer une réservation pour un restaurant, hôtel ou service.',
                parameters: {
                    type: 'object',
                    properties: {
                        customer_name: { type: 'string', description: 'Nom du client' },
                        booking_type: { type: 'string', enum: ['restaurant', 'hotel', 'service', 'other'] },
                        start_time: { type: 'string', description: 'Date et heure format ISO 8601 (ex: 2024-02-20T20:00:00)' },
                        party_size: { type: 'number', description: 'Nombre de personnes' },
                        notes: { type: 'string', description: 'Détails, allergies, type de chambre, etc.' }
                    },
                    required: ['customer_name', 'booking_type', 'start_time']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'create_order',
                description: 'Enregistrer une commande de produits.',
                parameters: {
                    type: 'object',
                    properties: {
                        customer_name: { type: 'string', description: 'Nom du client' },
                        delivery_address: { type: 'string', description: 'Adresse complète de livraison' },
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    product_name: { type: 'string', description: 'Nom exact du produit' },
                                    quantity: { type: 'number' },
                                    unit_price: { type: 'number', description: 'Prix unitaire (si connu/affiché)' }
                                },
                                required: ['product_name', 'quantity']
                            }
                        },
                        notes: { type: 'string' }
                    },
                    required: ['customer_name', 'items']
                }
            }
        }
    ]

    // Build messages array
    // Build messages array
    const userMessageContent: any[] = [{ type: 'text', text: userMessage }]

    // Add images if present
    if (options.inputImageUrls && options.inputImageUrls.length > 0) {
        options.inputImageUrls.forEach(url => {
            userMessageContent.push({
                type: 'image_url',
                image_url: { url: url }
            })
        })
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: enhancedSystemPrompt },
        ...conversationHistory.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
        })),
        { role: 'user', content: userMessageContent as any },
    ]

    try {
        const completion = await getOpenAIClient().chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            tools: tools,
            tool_choice: 'auto'
        })

        const responseMessage = completion.choices[0]?.message
        const responseContent = responseMessage?.content || ''
        const toolCalls = responseMessage?.tool_calls
        const tokensUsed = completion.usage?.total_tokens || 0

        return {
            content: responseContent,
            tokensUsed,
            model,
            responseTimeMs: Date.now() - startTime,
            toolCalls: toolCalls
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
        const completion = await getOpenAIClient().chat.completions.create({
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
        const completion = await getOpenAIClient().chat.completions.create({
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
        const completion = await getOpenAIClient().chat.completions.create({
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

        const transcription = await getOpenAIClient().audio.transcriptions.create({
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
        const mp3 = await getOpenAIClient().audio.speech.create({
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
        const response = await getOpenAIClient().embeddings.create({
            model: 'text-embedding-3-small',
            input: text.replace(/\n/g, ' '),
        })
        return response.data[0].embedding
    } catch (error) {
        console.error('Embedding Generation Error:', error)
        throw error
    }
}
