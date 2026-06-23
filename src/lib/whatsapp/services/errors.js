/**
 * ═══════════════════════════════════════════════════════════════
 * ERROR HANDLER & CUSTOM ERRORS
 * ═══════════════════════════════════════════════════════════════
 */

class AppError extends Error {
    constructor(message, context = {}) {
        super(message)
        this.name = this.constructor.name
        this.code = context.code || 'INTERNAL_ERROR'
        this.context = context
        Error.captureStackTrace(this, this.constructor)
    }
}

let Sentry = null
try {
    Sentry = require('@sentry/nextjs')
} catch (_) {
    Sentry = { captureException: () => {} }
}

class ErrorHandler {
    /**
     * Handle global message processing errors
     */
    static async handle(error, meta = {}) {
        const { agentId, message, activeSessions } = meta

        console.error('❌ CRITICAL ERROR handling message:', error)

        // 1. Log to Sentry (Monitoring Expert)
        Sentry.captureException(error, {
            extra: {
                agentId,
                from: message?.from,
                text: message?.text,
                isVoice: !!message?.audioMessage
            },
            tags: {
                component: 'whatsapp-bot',
                agent_id: agentId
            }
        })

        // 2. Fallback to client
        try {
            const session = activeSessions?.get(agentId)

            if (session && session.socket && message?.from) {
                const fallbackMessage = "Désolé, je réfléchis trop. Un petit instant... 🤔"

                await session.socket.sendMessage(message.from, {
                    text: fallbackMessage
                }, {
                    linkPreview: false
                })

                console.log('✅ Fallback response sent to client')
            }
        } catch (fallbackError) {
            console.error('❌ FAILED to send fallback message:', fallbackError.message)
        }
    }
}

module.exports = { AppError, ErrorHandler }
