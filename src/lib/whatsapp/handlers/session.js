const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const useSupabaseAuthState = require('../supabase-auth')
const { handleMessage } = require('./message')

const logger = pino({ level: 'warn' })

async function initSession(context, agentId, agentName) {
    const { supabase, activeSessions, pendingConnections } = context

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
        // const sessionDir = ensureSessionDir(agentId) // Legacy: No longer needed
        // const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
        const { state, saveCreds } = await useSupabaseAuthState(supabase, agentId)
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
                    setTimeout(() => initSession(context, agentId, agentName), 5000)
                } else {
                    activeSessions.delete(agentId)
                    /* 
                    // Session dir cleanup not needed with Supabase Auth
                    try {
                        fs.rmSync(sessionDir, { recursive: true, force: true })
                    } catch (e) { } 
                    */
                    await supabase.from('agents').update({
                        whatsapp_connected: false,
                        whatsapp_phone: null, // Fixed: whatsapp_phone_number -> whatsapp_phone check DB schema?
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
                let isVoiceMessage = false

                // Determine message type
                if (msg.message?.conversation) {
                    text = msg.message.conversation
                } else if (msg.message?.extendedTextMessage?.text) {
                    text = msg.message.extendedTextMessage.text
                } else if (msg.message?.imageMessage) {
                    text = msg.message.imageMessage.caption || ''
                } else if (msg.message?.audioMessage) {
                    isVoiceMessage = true
                    // Text will be transcribed in handleMessage
                }

                if (!text && !isVoiceMessage && !msg.message?.imageMessage) return

                // Construct simplified message object or pass full msg?
                // handleMessage expects { text, from, pushName, audioMessage?, imageMessage?, key }
                const messagePayload = {
                    text,
                    from: msg.key.remoteJid,
                    pushName: msg.pushName,
                    key: msg.key,
                    audioMessage: msg.message?.audioMessage,
                    imageMessage: msg.message?.imageMessage,
                    caption: msg.message?.imageMessage?.caption
                }

                await handleMessage(context, agentId, messagePayload, isVoiceMessage)
            }
        })

    } catch (error) {
        console.error(`Failed to initialize session for ${agentName}:`, error)
        pendingConnections.delete(agentId)
    }
}

module.exports = { initSession }
