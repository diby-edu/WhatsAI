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
    makeCacheableSignalKeyStore
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

// Generate AI response
async function generateAIResponse(agent, conversationHistory, userMessage, products) {
    try {
        const systemPrompt = `${agent.system_prompt || 'Tu es un assistant IA professionnel.'}

${products && products.length > 0 ? `
Produits disponibles:
${products.map(p => `- ${p.name}: ${p.price_fcfa} FCFA - ${p.description || ''}`).join('\n')}
` : ''}

Instructions:
- Réponds en ${agent.language || 'français'}
- ${agent.use_emojis ? 'Utilise des emojis' : 'Pas d\'emojis'}
- Sois concis et professionnel
- Ton nom est ${agent.name}`

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-15),
            { role: 'user', content: userMessage }
        ]

        const completion = await openai.chat.completions.create({
            model: agent.model || 'gpt-4o-mini',
            messages,
            max_tokens: agent.max_tokens || 500,
            temperature: agent.temperature || 0.7
        })

        return {
            content: completion.choices[0].message.content,
            tokensUsed: completion.usage?.total_tokens || 0
        }
    } catch (error) {
        console.error('OpenAI error:', error)
        return { content: 'Désolé, je rencontre un problème technique. Veuillez réessayer.', tokensUsed: 0 }
    }
}

// Handle incoming message
async function handleMessage(agentId, message) {
    console.log(`📩 Message received for agent ${agentId}:`, message.text?.substring(0, 50))

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
            .select('name, price_fcfa, description')
            .eq('user_id', agent.user_id)
            .eq('is_available', true)
            .limit(20)

        // Generate AI response
        console.log('🧠 Generating AI response...')
        const aiResponse = await generateAIResponse(
            agent,
            (messages || []).slice(0, -1).map(m => ({ role: m.role, content: m.content })),
            message.text,
            products
        )

        // Send response
        const session = activeSessions.get(agentId)
        if (session && session.socket) {
            const delay = (agent.response_delay_seconds || 2) * 1000

            // Simulate typing
            await session.socket.presenceSubscribe(message.from)
            await session.socket.sendPresenceUpdate('composing', message.from)
            await new Promise(r => setTimeout(r, delay))
            await session.socket.sendPresenceUpdate('paused', message.from)

            // Send message
            const result = await session.socket.sendMessage(message.from, { text: aiResponse.content })
            console.log('📤 Response sent:', result.key.id)

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
                credits_balance: profile.credits_balance - 1,
                credits_used_this_month: (profile.credits_used_this_month || 0) + 1
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
                } else if (msg.message?.imageMessage?.caption) {
                    text = msg.message.imageMessage.caption
                } else {
                    continue
                }

                await handleMessage(agentId, {
                    from: msg.key.remoteJid,
                    pushName: msg.pushName,
                    text,
                    messageId: msg.key.id
                })
            }
        })
    } catch (error) {
        console.error(`Error initializing session for ${agentName}:`, error)
        pendingConnections.delete(agentId)
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
