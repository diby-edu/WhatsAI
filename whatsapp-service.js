/**
 * WhatsApp Service - Standalone Process
 * This runs independently from the Next.js app
 * It should NEVER be restarted during deployments
 */

const { createClient } = require('@supabase/supabase-js')
const makeWASocket = require('@whiskeysockets/baileys').default
const {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    downloadMediaMessage
} = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const pino = require('pino')
const path = require('path')
const fs = require('fs')
const OpenAI = require('openai')

// Configuration from environment
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SESSION_BASE_DIR = process.env.WHATSAPP_SESSION_PATH || './.whatsapp-sessions'
const CHECK_INTERVAL = 5000 // Check every 5 seconds

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
const logger = pino({ level: 'warn' })

// Store active sessions
const activeSessions = new Map()
const pendingConnections = new Set()

// Ensure session directory exists
function ensureSessionDir(agentId) {
    const baseDir = path.resolve(SESSION_BASE_DIR)
    const sessionDir = path.join(baseDir, agentId)
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true })
    }
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true })
    }
    return sessionDir
}

// Find relevant documents from knowledge base
async function findRelevantDocuments(agentId, userQuery) {
    try {
        // 1. Generate embedding for user query
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: userQuery.replace(/\n/g, ' '),
        })
        const embedding = embeddingResponse.data[0].embedding

        // 2. Search in Supabase
        const { data: documents, error } = await supabase.rpc('match_documents', {
            query_embedding: embedding,
            match_threshold: 0.7, // 70% similarity threshold
            match_count: 3
        })

        if (error) {
            console.error('Vector search error:', error)
            return []
        }

        return documents || []
    } catch (error) {
        console.error('RAG Error:', error)
        return []
    }
}


// Analyze Sentiment
async function analyzeSentiment(text) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Analyze the sentiment of this message. Return JSON: { \"sentiment\": \"positive\"|\"neutral\"|\"negative\"|\"angry\", \"is_urgent\": boolean }" },
                { role: "user", content: text }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        });
        return JSON.parse(response.choices[0].message.content);
    } catch (e) {
        console.error("Sentiment Analysis Error:", e);
        return { sentiment: "neutral", is_urgent: false };
    }
}



// Transcribe Audio
async function transcribeAudio(audioBuffer) {
    try {
        const tempFile = path.join(SESSION_BASE_DIR, `temp_${Date.now()}.ogg`)
        fs.writeFileSync(tempFile, audioBuffer)

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFile),
            model: "whisper-1",
        })

        fs.unlinkSync(tempFile) // Cleanup
        return transcription.text
    } catch (e) {
        console.error('Transcription Error:', e)
        return ""
    }
}

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: 'Créer une nouvelle commande pour le client quand il confirme vouloir acheter.',
            parameters: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                product_name: { type: 'string', description: 'Nom complet du produit (ex: Pizza Reine Taille L, Supplément Fromage)' },
                                quantity: { type: 'number', description: 'Quantité demandée' }
                            },
                            required: ['product_name', 'quantity']
                        },
                        description: 'Liste des produits à commander'
                    },
                    delivery_address: { type: 'string', description: 'Adresse de livraison fournie par le client' },
                    delivery_city: { type: 'string', description: 'Ville de livraison' },
                    notes: { type: 'string', description: 'Notes supplémentaires (ex: Sans oignon)' }
                },
                required: ['items']
            }
        }
    }
]

// Tool Executor
async function handleToolCall(toolCall, agentId, customerPhone, products) {
    if (toolCall.function.name === 'create_order') {
        try {
            console.log('🛠️ Executing tool: create_order')
            const args = JSON.parse(toolCall.function.arguments)
            const { items, delivery_address, delivery_city, notes } = args

            // Get agent to find user_id (merchant)
            const { data: agent } = await supabase.from('agents').select('user_id').eq('id', agentId).single()
            if (!agent) throw new Error('Agent not found')

            let total = 0
            const orderItems = []

            // Match products and calculate total
            for (const item of items) {
                // Fuzzy match or exact match product
                const product = products.find(p => p.name.toLowerCase().includes(item.product_name.toLowerCase()))

                if (product) {
                    const price = product.price_fcfa || 0
                    total += price * item.quantity
                    orderItems.push({
                        product_name: product.name,
                        product_description: product.description,
                        quantity: item.quantity,
                        unit_price_fcfa: price
                    })
                } else {
                    // Product not found in catalog, treat as custom item if needed, strictly speaking we should skip or error
                    // For now, let's assume loose matching for demo
                    orderItems.push({
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price_fcfa: 0 // Unknown price
                    })
                }
            }

            // Create Order in DB
            const { data: order, error } = await supabase
                .from('orders')
                .insert({
                    user_id: agent.user_id,
                    agent_id: agentId,
                    customer_phone: customerPhone,
                    status: 'pending',
                    total_fcfa: total,
                    delivery_address: `${delivery_address || ''} ${delivery_city || ''}`.trim(),
                    notes: notes
                })
                .select()
                .single()

            if (error) throw error

            // Create Order Items
            if (orderItems.length > 0) {
                await supabase.from('order_items').insert(
                    orderItems.map(i => ({ ...i, order_id: order.id }))
                )
            }

            return JSON.stringify({
                success: true,
                order_id: order.id,
                message: `Commande #${order.id.substring(0, 8)} créée. Total: ${total} FCFA.`,
                payment_link: `https://whatsai.app/pay/${order.id}` // Mock link for now
            })

        } catch (error) {
            console.error('Tool Execution Error:', error)
            return JSON.stringify({ success: false, error: error.message })
        }
    }
    return JSON.stringify({ success: false, error: 'Unknown tool' })
}

// Generate AI response
async function generateAIResponse(options) {
    try {
        const {
            agent,
            conversationHistory,
            userMessage,
            products,
            orders,
            customerPhone,
            currency = 'USD' // Default currency
        } = options

        // Retrieve relevant knowledge (RAG)
        const relevantDocs = await findRelevantDocuments(agent.id, userMessage)

        // Build products catalog with CURRENCY CONVERSION
        let productsCatalog = ''
        if (products && products.length > 0) {
            productsCatalog = `\n\n🧠 CONTEXTE PRODUITS & SERVICES :
Tu as accès à la liste des produits/services vendus par l'entreprise.
Utilise ces informations pour guider le client.

LISTE DES OFFRES :
${products.map(p => {
                let displayPrice = p.price_fcfa
                let currencySymbol = '$'

                // SIMPLIFICATION: Raw value is display value
                if (currency === 'XOF') {
                    currencySymbol = 'FCFA'
                } else if (currency === 'EUR') {
                    currencySymbol = '€'
                }

                // VARIANT LOGIC
                let variantsInfo = ''
                if (p.variants && p.variants.length > 0) {
                    variantsInfo = `   ⚠️ OPTIONS REQUISES (Ne valide pas sans demander) :`
                    p.variants.forEach(v => {
                        variantsInfo += `\n      - ${v.name} (${v.type === 'fixed' ? 'Prix Fixe' : 'Supplément'}) : `
                        variantsInfo += v.options.map(opt => {
                            let optPrice = opt.price
                            const sign = v.type === 'additive' && optPrice > 0 ? '+' : ''
                            return `${opt.value} (${sign}${optPrice} ${currencySymbol})`
                        }).join(', ')
                    })
                }

                const hasVariants = p.variants && p.variants.length > 0
                const pricePrefix = hasVariants ? 'À partir de ' : ''

                return `🔹 ${p.name} - ${pricePrefix}${displayPrice ? displayPrice.toLocaleString('fr-FR') : ''} ${currencySymbol}
    📝 ${p.description || ''}${variantsInfo}`
            }).join('\n')}

INSTRUCTION IMPORTANTE : 
1. Si un produit a des VARIANTES (Options requises), tu NE PEUX PAS créer la commande tant que le client n'a pas fait son choix.
2. Si le type est 'fixed', le PRIX FINAL est celui de la variante choisie (Ignore le prix de base).
3. Si le type est 'additive', le PRIX FINAL est Prix Base + Supplément.`
        }

        const systemPrompt = `${agent.system_prompt || 'Tu es un assistant IA professionnel.'}

${productsCatalog}

${orders && orders.length > 0 ? `
Historique des Commandes du Client:
${orders.map(o => `- Commande #${o.id.substring(0, 8)} (${new Date(o.created_at).toLocaleDateString()}): ${o.status === 'pending' ? 'En attente' : o.status === 'paid' ? 'Payée' : o.status} - ${o.total_fcfa} FCFA
  Articles: ${o.items?.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}`).join('\n')}
` : ''}

${relevantDocs && relevantDocs.length > 0 ? `
BASE DE CONNAISSANCES (RAG):
${relevantDocs.map(doc => `- ${doc.content}`).join('\n\n')}
` : ''}

Instructions:
- Réponds en ${agent.language || 'français'}
- ${agent.use_emojis ? 'Utilise des emojis' : 'Pas d\'emojis'}
- Sois concis et professionnel
- Ton nom est ${agent.name}`

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-15)
        ]

        // Add user message (Multimodal if image exists)
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

        const completion = await openai.chat.completions.create({
            model: agent.model || 'gpt-4o-mini',
            messages,
            max_tokens: agent.max_tokens || 500,
            temperature: agent.temperature || 0.7,
            tools: TOOLS,
            tool_choice: 'auto'
        })

        const responseMessage = completion.choices[0].message
        let content = responseMessage.content

        // Handle Tool Calls
        if (responseMessage.tool_calls) {
            console.log('🤖 Model wants to call tools:', responseMessage.tool_calls.length)

            // Append initial model response (which contains the tool_call request) to history
            const newHistory = [
                ...messages,
                responseMessage
            ]

            for (const toolCall of responseMessage.tool_calls) {
                const toolResult = await handleToolCall(toolCall, agent.id, customerPhone, products)

                newHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            // Get final response from model
            const secondCompletion = await openai.chat.completions.create({
                model: agent.model || 'gpt-4o-mini',
                messages: newHistory,
                max_tokens: agent.max_tokens || 500,
                temperature: agent.temperature || 0.7
            })

            content = secondCompletion.choices[0].message.content
        }

        return {
            content: content,
            tokensUsed: (completion.usage?.total_tokens || 0) + 100 // Approx
        }
    } catch (error) {
        console.error('OpenAI error:', error)
        return { content: 'Désolé, je rencontre un problème technique. Veuillez réessayer.', tokensUsed: 0 }
    }
}

// Handle incoming message
async function handleMessage(agentId, message, isVoiceMessage = false) {
    console.log(`📩 Message received for agent ${agentId}:`, message.text?.substring(0, 50), message.imageBase64 ? '[HAS IMAGE]' : '')

    try {
        // Get agent
        const { data: agent } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single()

        if (!agent || !agent.is_active) {
            console.log('Agent not found or inactive')
            return
        }

        // Get or create conversation
        const phoneNumber = message.from.replace('@s.whatsapp.net', '').replace('@lid', '')

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
        }

        if (!conversation) return

        // Save incoming message
        await supabase.from('messages').insert({
            conversation_id: conversation.id,
            agent_id: agentId,
            role: 'user',
            content: message.text,
            whatsapp_message_id: message.messageId,
            status: 'read'
        })

        // Check if bot is paused
        if (conversation.bot_paused) {
            console.log('Bot is paused for this conversation')
            return
        }

        // Check credits
        const { data: profile } = await supabase
            .from('profiles')
            .select('credits_balance, credits_used_this_month')
            .eq('id', agent.user_id)
            .single()

        if (!profile || profile.credits_balance <= 0) {
            console.log('No credits left')
            return
        }

        // Get conversation history
        const { data: messages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: true })
            .limit(20)

        // Get products
        const { data: products } = await supabase
            .from('products')
            .select('name, price_fcfa, description, variants')
            .eq('user_id', agent.user_id)
            .eq('is_available', true)
            .limit(20)

        // Get recent orders for this customer (Context Injection)
        const { data: orders } = await supabase
            .from('orders')
            .select(`
                id,
                status,
                total_fcfa,
                created_at,
                items:order_items(product_name, quantity)
            `)
            .eq('user_id', agent.user_id)
            .eq('customer_phone', phoneNumber)
            .order('created_at', { ascending: false })
            .limit(5)

        // 🧠 SENTIMENT ANALYSIS (Phase 15)
        const sentimentAnalysis = await analyzeSentiment(message.text)
        console.log('❤️ Sentiment:', sentimentAnalysis)

        if (sentimentAnalysis.sentiment === 'angry' || sentimentAnalysis.sentiment === 'negative' && sentimentAnalysis.is_urgent) {
            console.log('🚨 ANGRY CUSTOMER DETECTED - ESCALATING')

            // 1. Mark conversation as escalated
            await supabase.from('conversations')
                .update({ status: 'escalated', bot_paused: true })
                .eq('id', conversation.id)

            // 2. Send Handover Message
            const handoverMessage = "Je détecte que vous n'êtes pas satisfait. Je suspends mon intelligence artificielle et je transmets immédiatement votre dossier à un superviseur humain. Il va vous répondre rapidement. 🙏"

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
            customerPhone: phoneNumber
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
                // Send TEXT message
                result = await session.socket.sendMessage(message.from, { text: aiResponse.content })
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

// Initialize WhatsApp session for an agent
async function initSession(agentId, agentName) {
    if (activeSessions.has(agentId) && activeSessions.get(agentId).status === 'connected') {
        console.log(`Session already active for ${agentName}`)
        return
    }

    if (pendingConnections.has(agentId)) {
        console.log(`Connection already pending for ${agentName}`)
        return
    }

    pendingConnections.add(agentId)
    console.log(`🔌 Initializing WhatsApp for ${agentName}...`)

    try {
        const sessionDir = ensureSessionDir(agentId)
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
        const { version } = await fetchLatestBaileysVersion()

        const socket = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            generateHighQualityLinkPreview: true
        })

        const session = { socket, status: 'connecting', agentName }
        activeSessions.set(agentId, session)

        // Handle connection updates
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                session.status = 'qr_waiting'
                console.log(`📱 QR code ready for ${agentName}`)

                // Convert QR to data URL and store in database
                const qrDataUrl = await QRCode.toDataURL(qr)
                await supabase.from('agents').update({
                    whatsapp_qr_code: qrDataUrl,
                    whatsapp_status: 'qr_ready'
                }).eq('id', agentId)
            }

            if (connection === 'open') {
                session.status = 'connected'
                pendingConnections.delete(agentId)
                const phoneNumber = socket.user?.id.split(':')[0] || null
                console.log(`✅ ${agentName} connected: ${phoneNumber}`)

                await supabase.from('agents').update({
                    whatsapp_connected: true,
                    whatsapp_phone: phoneNumber,
                    whatsapp_qr_code: null,
                    whatsapp_status: 'connected'
                }).eq('id', agentId)
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut

                console.log(`❌ ${agentName} disconnected, code: ${statusCode}, reconnect: ${shouldReconnect}`)
                pendingConnections.delete(agentId)

                if (shouldReconnect) {
                    activeSessions.delete(agentId)
                    setTimeout(() => initSession(agentId, agentName), 5000)
                } else {
                    activeSessions.delete(agentId)
                    try {
                        fs.rmSync(sessionDir, { recursive: true, force: true })
                    } catch (e) { }
                    await supabase.from('agents').update({
                        whatsapp_connected: false,
                        whatsapp_phone_number: null,
                        whatsapp_qr_code: null,
                        whatsapp_status: 'disconnected'
                    }).eq('id', agentId)
                }
            }
        })

        // Handle credentials update
        socket.ev.on('creds.update', saveCreds)

        // Handle incoming messages
        socket.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
            if (type !== 'notify') return

            for (const msg of msgs) {
                if (msg.key.fromMe) continue

                let text = ''
                if (msg.message?.conversation) {
                    text = msg.message.conversation
                } else if (msg.message?.extendedTextMessage?.text) {
                    text = msg.message.extendedTextMessage.text
                } else if (msg.message?.imageMessage) {
                    console.log('📸 Image received, downloading...')
                    try {
                        const buffer = await downloadMediaMessage(
                            msg,
                            'buffer',
                            { logger }
                        )
                        // Convert to base64
                        const imageBase64 = buffer.toString('base64')
                        text = msg.message.imageMessage.caption || '' // Get caption if any

                        await handleMessage(agentId, {
                            from: msg.key.remoteJid,
                            pushName: msg.pushName,
                            text,
                            messageId: msg.key.id,
                            imageBase64 // Pass image data
                        }, false)
                        continue
                    } catch (err) {
                        console.error('Failed to process image:', err)
                        continue
                    }
                } else if (msg.message?.audioMessage) {
                    console.log('🎤 Voice note received, transcribing...')
                    try {
                        const buffer = await downloadMediaMessage(
                            msg,
                            'buffer',
                            { logger }
                        )
                        text = await transcribeAudio(buffer)
                        console.log('📝 Transcribed:', text)
                    } catch (err) {
                        console.error('Failed to process audio:', err)
                        continue
                    }
                } else {
                    continue
                }

                // Filter out status updates and newsletters
                if (msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid.includes('@newsletter')) {
                    continue
                }

                await handleMessage(agentId, {
                    from: msg.key.remoteJid,
                    pushName: msg.pushName,
                    text,
                    messageId: msg.key.id
                }, !!msg.message?.audioMessage) // Pass true if it was an audio message
            }
        })
    } catch (error) {
        console.error(`Error initializing session for ${agentName}:`, error)
        pendingConnections.delete(agentId)
    }
}

// Check for pending messages to send (Manual Replies)
async function checkPendingMessages() {
    try {
        const { data: pendingMessages } = await supabase
            .from('messages')
            .select(`
                *,
                conversation:conversations!inner(
                    contact_phone,
                    agent_id
                )
            `)
            .eq('status', 'pending')
            .eq('role', 'assistant') // Ensure we only send assistant messages
            .limit(10) // Process in batches

        for (const msg of pendingMessages || []) {
            const agentId = msg.conversation.agent_id
            const phoneNumber = msg.conversation.contact_phone
            const session = activeSessions.get(agentId)

            if (session && session.socket && session.status === 'connected') {
                console.log(`📤 Sending pending message ${msg.id} to ${phoneNumber}`)

                try {
                    const result = await session.socket.sendMessage(
                        phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`,
                        { text: msg.content }
                    )

                    // Update as sent
                    await supabase
                        .from('messages')
                        .update({
                            status: 'sent',
                            whatsapp_message_id: result.key.id,
                            sent_at: new Date().toISOString()
                        })
                        .eq('id', msg.id)

                    console.log(`✅ Message ${msg.id} sent successfully`)
                } catch (sendError) {
                    console.error(`❌ Failed to send pending message ${msg.id}:`, sendError)
                    // Update as failed
                    await supabase
                        .from('messages')
                        .update({
                            status: 'failed',
                            error_message: sendError.message
                        })
                        .eq('id', msg.id)
                }
            } else {
                // Agent not connected, skip for now
                // console.log(`⚠️ Agent ${agentId} not connected, skipping pending message`)
            }
        }
    } catch (error) {
        console.error('Error checking pending messages:', error)
    }
}

// Check for agents that need connection
async function checkAgents() {
    try {
        // 1. Check for agents requesting connection (whatsapp_status = 'connecting')
        const { data: connectingAgents } = await supabase
            .from('agents')
            .select('id, name')
            .eq('is_active', true)
            .eq('whatsapp_status', 'connecting')

        for (const agent of connectingAgents || []) {
            if (!activeSessions.has(agent.id) && !pendingConnections.has(agent.id)) {
                console.log(`🔄 New connection request for ${agent.name}`)
                await initSession(agent.id, agent.name)
            }
        }

        // 2. Check for agents that should be connected and have session files
        const { data: connectedAgents } = await supabase
            .from('agents')
            .select('id, name')
            .eq('is_active', true)
            .eq('whatsapp_connected', true)

        for (const agent of connectedAgents || []) {
            const sessionDir = path.join(path.resolve(SESSION_BASE_DIR), agent.id)
            const credsFile = path.join(sessionDir, 'creds.json')

            if (fs.existsSync(credsFile) && !activeSessions.has(agent.id) && !pendingConnections.has(agent.id)) {
                console.log(`🔄 Restoring session for ${agent.name}`)
                await initSession(agent.id, agent.name)
            }
        }
    } catch (error) {
        console.error('Error checking agents:', error)
    }
}

// Main loop
async function main() {
    console.log('🚀 WhatsApp Service starting...')
    console.log('📁 Session directory:', path.resolve(SESSION_BASE_DIR))

    // Ensure session directory exists
    if (!fs.existsSync(SESSION_BASE_DIR)) {
        fs.mkdirSync(SESSION_BASE_DIR, { recursive: true })
    }

    // Initial check
    await checkAgents()

    // Periodic check for new agents
    setInterval(checkAgents, CHECK_INTERVAL)
    // Periodic check for pending messages
    setInterval(checkPendingMessages, 2000) // Check more frequently for responsiveness

    console.log('✅ WhatsApp Service running')
    console.log('⚠️  DO NOT restart this service during deployments!')
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('📴 Shutting down WhatsApp Service...')
    for (const [agentId, session] of activeSessions) {
        if (session.socket) {
            session.socket.end()
        }
    }
    process.exit(0)
})

main()
