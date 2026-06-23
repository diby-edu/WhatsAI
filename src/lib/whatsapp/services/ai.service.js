/**
 * ═══════════════════════════════════════════════════════════════
 * AI SERVICE
 * ═══════════════════════════════════════════════════════════════
 * 
 * Responsabilité : Génération de réponses IA (wrapper)
 */

const { generateAIResponse } = require('../ai/generator')
const { notifyAdmins } = require('../../notifications/admin-notify')

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

        // Détecter si une commande vient d'être passée (moins de 5 minutes)
        let justOrdered = false
        if (context.orders && context.orders.length > 0) {
            const lastOrder = context.orders[0]
            const orderTime = new Date(lastOrder.created_at).getTime()
            const timeDiff = Date.now() - orderTime
            if (timeDiff < 5 * 60 * 1000) { // 5 minutes
                justOrdered = true
            }
        }

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
            conversationId: context.conversationId,
            checkoutState: context.checkoutState,
            cartState: context.cartState,
            cartQuestionDetected: context.cartQuestionDetected ?? false,
            checkoutQuestionDetected: context.checkoutQuestionDetected ?? false,
            bookingState: context.bookingState,
            restaurantState: context.restaurantState,
            hasKnowledgeBase: context.hasKnowledgeBase ?? false,
            featureFlags: context.featureFlags || {},
            justOrdered // Signal pour le prompt builder
        }

        // Préparer les dépendances (services externes)
        const dependencies = {
            openai,
            supabase: context.supabase,
            activeSessions: context.activeSessions,
            CinetPay: context.CinetPay
        }

        // Déléguer à la fonction existante avec 2 arguments
        try {
            return await generateAIResponse(generatorOptions, dependencies)
        } catch (error) {
            // Notify admins on OpenAI API errors (rate limit, quota, network, etc.)
            const isOpenAIError = error?.status || error?.code || String(error?.message || '').includes('openai')
            if (isOpenAIError) {
                notifyAdmins('openai_error', {
                    errorMessage: error?.message || String(error),
                    agentName: agent?.name,
                }).catch(() => {})
            }
            throw error
        }
    }
}

module.exports = { AIService }
