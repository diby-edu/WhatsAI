// This file exports WhatsApp services
// Note: These functions require a server-side environment (API routes)

export {
    initWhatsAppSession,
    getSessionStatus,
    sendWhatsAppMessage,
    sendMessageWithTyping,
    closeWhatsAppSession,
    logoutWhatsApp,
    hasStoredSession,
    getAllActiveSessions,
    setMessageHandler,
    setStatusHandler,
} from './baileys'

export type {
    WhatsAppSession,
    WhatsAppMessage,
} from './baileys'

export { initializeMessageHandler } from './message-handler'
