/**
 * ═══════════════════════════════════════════════════════════════
 * PROMPT BUILDER v2.40 - MODULAR REFACTORING
 * ═══════════════════════════════════════════════════════════════
 * 
 * Ce fichier est maintenant l'ORCHESTRATEUR.
 * Il assemble les modules situés dans ./prompts/
 */

const { buildResetContext, variantsRules, antiLoopRules, toolsDefinition } = require('./prompts/context-rules')
const { buildGenericWorkflow } = require('./prompts/workflow-generic')
const { prompt_STAY } = require('./prompts/workflow-service-stay')
const { prompt_TABLE } = require('./prompts/workflow-service-table')
const { prompt_SLOT } = require('./prompts/workflow-service-slot')
const { prompt_RENTAL } = require('./prompts/workflow-service-rental')
const { buildCatalogueSection, buildClientHistory, buildKnowledgeSection } = require('./prompts/sections')

// Mapping des sous-types de services vers les moteurs de template
const SERVICE_ENGINE_MAP = {
    'hotel': 'STAY',
    'residence': 'STAY',
    'restaurant': 'TABLE',
    'event': 'TABLE',
    'rental': 'RENTAL',
    'formation': 'SLOT',
    'coiffeur': 'SLOT',
    'medecin': 'SLOT',
    'coaching': 'SLOT',
    'prestation': 'SLOT',
    'other': 'SLOT'
}

function buildAdaptiveSystemPrompt(agent, products, orders, relevantDocs, currency, gpsLink, formattedHours, justOrdered = false, userMessage = '') {

    // 1. ANALYSE DU CONTEXTE AGENT & PRODUITS
    const serviceProducts = products.filter(p => p.product_type === 'service')
    const isServiceOnlyAgent = (products.length > 0 && serviceProducts.length === products.length)

    // 2. DÉTECTION INTENTION & MOTEUR
    let conversationIntent = 'generic' // 'product_order' (default)
    let activeEngine = null

    if (isServiceOnlyAgent) {
        // Agent 100% service : utiliser le template du premier service trouvé
        const mainService = serviceProducts[0]
        const subtype = mainService.service_subtype || 'other'
        // console.log(`🏨 SERVICE-ONLY AGENT: ${subtype} (${serviceProducts.length} services)`)
        conversationIntent = 'service_booking'
        activeEngine = SERVICE_ENGINE_MAP[subtype] || 'SLOT'
    } else if (userMessage && products && products.length > 0) {
        // Agent mixte : détecter via le nom du produit dans le message
        const lowerMsg = userMessage.toLowerCase()

        // Chercher le produit le plus long qui matche
        const matchedProduct = products
            .filter(p => lowerMsg.includes(p.name.toLowerCase()))
            .sort((a, b) => b.name.length - a.name.length)[0]

        if (matchedProduct && matchedProduct.service_subtype) {
            // console.log(`🧠 INTENT DETECTED: ${matchedProduct.name} -> ${matchedProduct.service_subtype}`)
            conversationIntent = 'service_booking'
            activeEngine = SERVICE_ENGINE_MAP[matchedProduct.service_subtype] || 'SLOT'
        }
    }

    // 3. CONSTRUCTION DES SECTIONS

    // Section 0: Reset (Anti-Zombie)
    const resetContext = buildResetContext(orders, justOrdered)

    // Section 1: Identité
    const identity = `
Tu es l'assistant IA de ${agent.name}.
Langue: ${agent.language || 'français'}.
${agent.use_emojis ? 'Utilise des emojis modérément.' : ''}
Style: Concis (max 3-4 phrases), amical, professionnel.

📢 RÈGLE D'ACCUEIL (CRITIQUE) :
Si le client dit "Salut", "Bonjour", "Menu" ou commence la conversation:
1. Saluer chaleureusement ("Bienvenue chez ${agent.name} ! 👋")
2. AFFICHER LE CATALOGUE (la liste des produits ci-dessous)
3. Demander: "${isServiceOnlyAgent ? 'Quelle prestation souhaitez-vous réserver ?' : 'Quel article vous intéresse ?'}"
⛔ INTERDIT de dire juste "Comment puis-je vous aider ?" sans afficher le catalogue. Tu es un VENDEUR.
`

    // Section 2: Catalogue
    const catalogueSection = buildCatalogueSection(products, currency)

    // Section 3: Workflow (Le cœur du système)
    let collectOrder = ''

    // Logique de bascule (Switch Engine)
    if (conversationIntent === 'service_booking' && activeEngine) {
        if (activeEngine === 'STAY') collectOrder = prompt_STAY
        else if (activeEngine === 'TABLE') collectOrder = prompt_TABLE
        else if (activeEngine === 'SLOT') collectOrder = prompt_SLOT
        else if (activeEngine === 'RENTAL') collectOrder = prompt_RENTAL
        else collectOrder = buildGenericWorkflow(orders, products) // Fallback
    } else {
        collectOrder = buildGenericWorkflow(orders, products) // Default Generic/Mixed
    }
    console.log(`🧠 [DEBUG] Intent: ${conversationIntent}, Engine: ${activeEngine}, WorkflowLen: ${collectOrder.length}`)

    // Section 4: Contexte & Business Info
    const clientHistory = buildClientHistory(orders)
    const knowledgeSection = buildKnowledgeSection(relevantDocs)

    const businessInfo = (agent.business_address || gpsLink || formattedHours !== 'Non spécifiés')
        ? `
🏢 INFOS:
${agent.business_address ? `📍 ${agent.business_address}` : ''}
${gpsLink ? `🗺️ ${gpsLink}` : ''}
${formattedHours !== 'Non spécifiés' ? `⏰ ${formattedHours}` : ''}
    ` : ''

    // 4. ASSEMBLAGE FINAL
    return `${resetContext}
${variantsRules}
${identity}
${catalogueSection}
${collectOrder}
${antiLoopRules}
${toolsDefinition}
${clientHistory}
${knowledgeSection}
${businessInfo}`.trim()
}

module.exports = { buildAdaptiveSystemPrompt }
