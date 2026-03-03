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

async function initSession(context, agentId, agentName, reconnectAttempt = 0) {
    const { supabase, activeSessions, pendingConnections, openai, CinetPay } = context


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

        const session = {
            socket,
            status: 'connecting',
            agentName,
            reconnectAttempts: reconnectAttempt
        }
        activeSessions.set(agentId, session)

        // 💓 KEEPALIVE: Envoie un ping toutes les 14 minutes pour éviter la déconnexion
        // WhatsApp ferme les connexions inactives après ~30 minutes sans activité
        let keepAliveInterval = null

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

                // Ne pas écraser whatsapp_phone avec null si socket.user n'est pas encore disponible
                // (cas du restart PM2 où socket.user peut être null à l'instant de l'événement)
                const updateData = {
                    whatsapp_connected: true,
                    whatsapp_qr_code: null,
                    whatsapp_status: 'connected'
                }
                if (phoneNumber) updateData.whatsapp_phone = phoneNumber

                await supabase.from('agents').update(updateData).eq('id', agentId)

                // 💓 Démarrer le keepalive (ping toutes les 14 min)
                if (keepAliveInterval) clearInterval(keepAliveInterval)
                keepAliveInterval = setInterval(async () => {
                    if (session.status === 'connected') {
                        try {
                            await socket.sendPresenceUpdate('available')
                            console.log(`💓 Keepalive [${agentName}]`)
                        } catch (e) { /* Ignorer les erreurs keepalive */ }
                    }
                }, 14 * 60 * 1000)

                // 🔔 NOTIFICATION: Uniquement à la première connexion (pas sur reconnexion auto)
                // reconnectAttempt === 0 = première connexion réelle (scan QR ou démarrage initial)
                // reconnectAttempt > 0  = reconnexion automatique après coupure → pas de notification
                if (reconnectAttempt === 0) {
                    try {
                        const { data: agent } = await supabase.from('agents').select('user_id').eq('id', agentId).single()
                        if (agent?.user_id) {
                            const { notify } = require('../../notifications/notify')
                            notify(agent.user_id, 'agent_status_change', { agentName, agentStatus: 'connected' })
                            // Notify admins too
                            const { notifyAdmins } = require('../../notifications/admin-notify')
                            notifyAdmins('agent_connected', { agentName, agentId })
                        }
                    } catch (notifError) {
                        console.error('🔔 Notification error (non-blocking):', notifError)
                    }
                } else {
                    console.log(`🔄 Reconnexion silencieuse [${agentName}] (tentative ${reconnectAttempt}) — pas de notification`)
                }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut

                console.log(`❌ ${agentName} disconnected, code: ${statusCode}, reconnect: ${shouldReconnect}`)
                pendingConnections.delete(agentId)

                // Arrêter le keepalive lors de la déconnexion
                if (keepAliveInterval) {
                    clearInterval(keepAliveInterval)
                    keepAliveInterval = null
                }

                if (shouldReconnect) {
                    activeSessions.delete(agentId)

                    // ⭐ EXPONENTIAL BACKOFF (Robustesse Expert)
                    // Augmente le délai à chaque tentative pour éviter le spam/ban
                    const attempt = (session.reconnectAttempts || 0) + 1
                    const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60000) // Max 1 minute

                    console.log(`📡 Reconnecting in ${delay / 1000}s (Attempt ${attempt})...`)

                    setTimeout(async () => {
                        // ⭐ FIX: Vérifier si l'agent veut toujours être connecté avant de reconnecter
                        // Évite que la reconnexion auto remette whatsapp_connected=true après une déco volontaire
                        const { data: agentCheck } = await supabase
                            .from('agents')
                            .select('is_active, whatsapp_connected')
                            .eq('id', agentId)
                            .single()

                        if (!agentCheck?.is_active) {
                            console.log(`🚫 [${agentName}] Agent inactif (is_active=false), reconnexion annulée`)
                            return
                        }
                        if (agentCheck?.whatsapp_connected === false) {
                            console.log(`🚫 [${agentName}] Déconnexion volontaire détectée (whatsapp_connected=false), reconnexion annulée`)
                            return
                        }

                        initSession(context, agentId, agentName, attempt)
                    }, delay)
                } else {
                    activeSessions.delete(agentId)

                    // ⭐ ROBUST CLEANUP (Sécurité Expert)
                    // Supprime toutes les clés de session dans Supabase si déconnexion définitive
                    console.log(`🧹 Cleaning up session data for ${agentName}...`)

                    supabase
                        .from('whatsapp_sessions')
                        .delete()
                        .eq('session_id', agentId)
                        .then(({ error }) => {
                            if (error) console.error('❌ Failed to cleanup session:', error.message)
                            else console.log('✅ Session data cleared from DB')
                        })

                    /* 
                    // Session dir cleanup not needed with Supabase Auth
                    try {
                        fs.rmSync(sessionDir, { recursive: true, force: true })
                    } catch (e) { } 
                    */
                    await supabase.from('agents').update({
                        whatsapp_connected: false,
                        whatsapp_qr_code: null,
                        whatsapp_status: 'disconnected'
                        // whatsapp_phone conservé intentionnellement pour affichage dashboard
                    }).eq('id', agentId)

                    // 🔔 NOTIFICATION: Agent déconnecté (définitivement)
                    try {
                        const { data: agent } = await supabase.from('agents').select('user_id').eq('id', agentId).single()
                        if (agent?.user_id) {
                            const { notify } = require('../../notifications/notify')
                            notify(agent.user_id, 'agent_status_change', { agentName, agentStatus: 'disconnected' })
                            // Notify admins too
                            const { notifyAdmins } = require('../../notifications/admin-notify')
                            notifyAdmins('agent_disconnected', { agentName, agentId })
                        }
                    } catch (notifError) {
                        console.error('🔔 Notification error (non-blocking):', notifError)
                    }
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
                // Ignorer les messages de groupe — le bot ne répond qu'en 1-à-1
                if (msg.key.remoteJid?.endsWith('@g.us')) continue

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
