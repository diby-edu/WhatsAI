/**
 * ═══════════════════════════════════════════════════════════════
 * AI SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : Génération de réponses IA (wrapper)
 */

const { generateAIResponse } = require('../ai/generator')

class AIService {
    /**
     * Génère une réponse IA
     */
    static async generate(options) {
        const {
            agent,
            message,
            context,
            openai
        } = options

        // Déléguer à la fonction existante
        return await generateAIResponse({
            agent,
            conversationHistory: context.history,
            userMessage: message.text,
            imageBase64: message.imageBase64,
            products: context.products,
            currency: context.currency,
            orders: context.orders,
            activeSessions: context.activeSessions,
            supabase: context.supabase,
            openai,
            CinetPay: context.CinetPay
        })
    }
}

module.exports = { AIService }
