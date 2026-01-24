
/**
 * ═══════════════════════════════════════════════════════════════
 * TOOLS.JS v4.0 - MODULAR ORCHESTRATOR
 * ═══════════════════════════════════════════════════════════════
 *
 * Ce fichier est maintenant l'ORCHESTRATEUR DES OUTILS.
 * Il délègue l'exécution aux modules situés dans ./tools/
 */

const { TOOLS } = require('./tools/definitions')
const { handleCreateOrder, handleCheckPaymentStatus, handleFindOrder } = require('./tools/tool-orders')
const { handleCreateBooking } = require('./tools/tool-bookings')
const { handleSendImage } = require('./tools/tool-images')
const {
    normalizePhoneNumber,
    checkStock,
    productHasRealVariants,
    findMatchingOption,
    getOptionValue,
    getOptionPrice
} = require('./tools/tool-helpers')

// ═══════════════════════════════════════════════════════════════
// 🔧 TOOL EXECUTOR DISPATCHER
// ═══════════════════════════════════════════════════════════════

async function handleToolCall(toolCall, agentId, customerPhone, products, conversationId, supabase, _activeSessions, _CinetPay) {
    const functionName = toolCall.function.name
    let args = {}

    try {
        args = JSON.parse(toolCall.function.arguments)
    } catch (e) {
        console.error("❌ Erreur parsing arguments tool:", e)
        return JSON.stringify({ success: false, error: "Arguments invalides" })
    }

    switch (functionName) {
        case 'create_order':
            return await handleCreateOrder(args, agentId, products, conversationId, supabase)

        case 'check_payment_status':
            return await handleCheckPaymentStatus(args, supabase)

        case 'find_order':
            return await handleFindOrder(args, supabase)

        case 'create_booking':
            return await handleCreateBooking(args, agentId, products, conversationId, supabase)

        case 'send_image':
            return await handleSendImage(args, products)

        default:
            console.error(`❌ Outil inconnu: ${functionName}`)
            return JSON.stringify({ success: false, error: 'Outil inconnu' })
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    TOOLS,
    handleToolCall,
    // Exports Helpers (utilisés par generator.js)
    findMatchingOption,
    getOptionValue,
    getOptionPrice,
    productHasRealVariants,
    checkStock
}
