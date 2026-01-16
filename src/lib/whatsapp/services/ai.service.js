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

        // Préparer les options (données du message)
        const generatorOptions = {
            agent,
            conversationHistory: context.history,
            userMessage: message.text,
            imageBase64: message.imageBase64,
            products: context.products,
            currency: context.currency,
            orders: context.orders,
            customerPhone: message.from,
            conversationId: context.conversationId
        }

        // Préparer les dépendances (services externes)
        const dependencies = {
            openai,
            supabase: context.supabase,
            activeSessions: context.activeSessions,
            CinetPay: context.CinetPay
        }

        // Déléguer à la fonction existante avec 2 arguments
        return await generateAIResponse(generatorOptions, dependencies)
    }
}

module.exports = { AIService }
