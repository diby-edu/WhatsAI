import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket,
    BaileysEventMap,
    ConnectionState,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import * as QRCode from 'qrcode'
import pino from 'pino'
import path from 'path'
import fs from 'fs'

// Types
export interface WhatsAppSession {
    socket: WASocket
    qrCode: string | null
    linkingCode: string | null
    status: 'connecting' | 'qr_ready' | 'connected' | 'disconnected'
    phoneNumber: string | null
}

export interface WhatsAppMessage {
    from: string
    pushName: string | null
    message: string
    messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker'
    timestamp: number
    messageId: string
}

// Store active sessions
const activeSessions: Map<string, WhatsAppSession> = new Map()

// Logger configuration
const logger = pino({
    level: 'warn',
})

// Session directory
const SESSION_BASE_DIR = process.env.WHATSAPP_SESSION_PATH || './.whatsapp-sessions'

// Ensure session directory exists
function ensureSessionDir(agentId: string): string {
    const sessionDir = path.join(SESSION_BASE_DIR, agentId)
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true })
    }
    return sessionDir
}

// Message handlers
type MessageHandler = (agentId: string, message: WhatsAppMessage) => Promise<void>
type StatusHandler = (agentId: string, status: ConnectionState) => void

let onMessageReceived: MessageHandler | null = null
let onStatusChange: StatusHandler | null = null

export function setMessageHandler(handler: MessageHandler) {
    onMessageReceived = handler
}

export function setStatusHandler(handler: StatusHandler) {
    onStatusChange = handler
}

/**
 * Initialize a WhatsApp connection for an agent
 */
export async function initWhatsAppSession(
    agentId: string,
    options: {
        useLinkingCode?: boolean
        phoneNumber?: string
    } = {}
): Promise<{ qrCode?: string; linkingCode?: string; status: string }> {
    // Close existing session if any
    await closeWhatsAppSession(agentId)

    const sessionDir = ensureSessionDir(agentId)
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const { version } = await fetchLatestBaileysVersion()

    const socket = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        generateHighQualityLinkPreview: true,
    })

    // Initialize session object
    const session: WhatsAppSession = {
        socket,
        qrCode: null,
        linkingCode: null,
        status: 'connecting',
        phoneNumber: null,
    }
    activeSessions.set(agentId, session)

    // Handle connection events
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        // QR Code received
        if (qr) {
            session.status = 'qr_ready'
            session.qrCode = await QRCode.toDataURL(qr)

            // If using linking code instead of QR
            if (options.useLinkingCode && options.phoneNumber) {
                try {
                    const code = await socket.requestPairingCode(options.phoneNumber)
                    session.linkingCode = code
                } catch (error) {
                    console.error('Error requesting pairing code:', error)
                }
            }
        }

        // Connection opened
        if (connection === 'open') {
            session.status = 'connected'
            session.qrCode = null
            session.linkingCode = null

            // Get phone number from credentials
            const phoneNumber = socket.user?.id.split(':')[0] || null
            session.phoneNumber = phoneNumber

            console.log(`WhatsApp connected for agent ${agentId}: ${phoneNumber}`)
        }

        // Connection closed
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut

            console.log(`WhatsApp disconnected for agent ${agentId}, reconnect: ${shouldReconnect}`)

            if (shouldReconnect) {
                // Wait before reconnecting
                setTimeout(() => {
                    initWhatsAppSession(agentId, options)
                }, 3000)
            } else {
                session.status = 'disconnected'
                // Clear session files if logged out
                if (statusCode === DisconnectReason.loggedOut) {
                    fs.rmSync(sessionDir, { recursive: true, force: true })
                }
            }
        }

        // Notify status change
        if (onStatusChange) {
            onStatusChange(agentId, update)
        }
    })

    // Handle credentials update
    socket.ev.on('creds.update', saveCreds)

    // Handle incoming messages
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return

        for (const msg of messages) {
            // Ignore messages from self
            if (msg.key.fromMe) continue

            // Extract message content
            const messageContent = msg.message
            if (!messageContent) continue

            // Determine message type and extract text
            let text = ''
            let messageType: WhatsAppMessage['messageType'] = 'text'

            if (messageContent.conversation) {
                text = messageContent.conversation
            } else if (messageContent.extendedTextMessage?.text) {
                text = messageContent.extendedTextMessage.text
            } else if (messageContent.imageMessage) {
                messageType = 'image'
                text = messageContent.imageMessage.caption || '[Image]'
            } else if (messageContent.audioMessage) {
                messageType = 'audio'
                text = '[Audio message]'
            } else if (messageContent.videoMessage) {
                messageType = 'video'
                text = messageContent.videoMessage.caption || '[Video]'
            } else if (messageContent.documentMessage) {
                messageType = 'document'
                text = messageContent.documentMessage.fileName || '[Document]'
            } else if (messageContent.stickerMessage) {
                messageType = 'sticker'
                text = '[Sticker]'
            } else {
                continue // Skip unsupported message types
            }

            const whatsappMessage: WhatsAppMessage = {
                from: msg.key.remoteJid || '',
                pushName: msg.pushName || null,
                message: text,
                messageType,
                timestamp: msg.messageTimestamp as number,
                messageId: msg.key.id || '',
            }

            // Call message handler
            if (onMessageReceived) {
                try {
                    await onMessageReceived(agentId, whatsappMessage)
                } catch (error) {
                    console.error('Error handling message:', error)
                }
            }
        }
    })

    // Wait a bit for initial connection
    await new Promise((resolve) => setTimeout(resolve, 2000))

    return {
        qrCode: session.qrCode || undefined,
        linkingCode: session.linkingCode || undefined,
        status: session.status,
    }
}

/**
 * Get current session status
 */
export function getSessionStatus(agentId: string): WhatsAppSession | null {
    return activeSessions.get(agentId) || null
}

/**
 * Send a text message
 */
export async function sendWhatsAppMessage(
    agentId: string,
    to: string,
    message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const session = activeSessions.get(agentId)

    if (!session || session.status !== 'connected') {
        return { success: false, error: 'WhatsApp not connected' }
    }

    try {
        // Format phone number (add @s.whatsapp.net if not present)
        const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`

        const result = await session.socket.sendMessage(jid, { text: message })

        return { success: true, messageId: result?.key.id }
    } catch (error) {
        console.error('Error sending message:', error)
        return { success: false, error: (error as Error).message }
    }
}

/**
 * Send a message with typing indicator
 */
export async function sendMessageWithTyping(
    agentId: string,
    to: string,
    message: string,
    typingDurationMs: number = 2000
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const session = activeSessions.get(agentId)

    if (!session || session.status !== 'connected') {
        return { success: false, error: 'WhatsApp not connected' }
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`

    try {
        // Show typing indicator
        await session.socket.sendPresenceUpdate('composing', jid)

        // Wait for typing duration
        await new Promise((resolve) => setTimeout(resolve, typingDurationMs))

        // Send the message
        const result = await session.socket.sendMessage(jid, { text: message })

        // Stop typing
        await session.socket.sendPresenceUpdate('paused', jid)

        return { success: true, messageId: result?.key.id }
    } catch (error) {
        console.error('Error sending message:', error)
        return { success: false, error: (error as Error).message }
    }
}

/**
 * Close a WhatsApp session
 */
export async function closeWhatsAppSession(agentId: string): Promise<void> {
    const session = activeSessions.get(agentId)

    if (session) {
        try {
            await session.socket.end()
        } catch (error) {
            console.error('Error closing session:', error)
        }
        activeSessions.delete(agentId)
    }
}

/**
 * Logout and delete session
 */
export async function logoutWhatsApp(agentId: string): Promise<void> {
    const session = activeSessions.get(agentId)

    if (session) {
        try {
            await session.socket.logout()
        } catch (error) {
            console.error('Error logging out:', error)
        }
        activeSessions.delete(agentId)
    }

    // Delete session files
    const sessionDir = path.join(SESSION_BASE_DIR, agentId)
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true })
    }
}

/**
 * Check if session exists without connecting
 */
export function hasStoredSession(agentId: string): boolean {
    const sessionDir = path.join(SESSION_BASE_DIR, agentId)
    return fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0
}

/**
 * Get all active sessions
 */
export function getAllActiveSessions(): Map<string, WhatsAppSession> {
    return activeSessions
}
