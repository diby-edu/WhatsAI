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
const { buildCatalogueSection, buildClientHistory, buildKnowledgeSection, buildProductsCatalogSection } = require('./prompts/sections')

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
    const hasProducts = products && products.length > 0
    const identity = `
Tu es l'assistant IA de ${agent.name}.
Langue: ${agent.language || 'français'}.
${agent.use_emojis ? 'Utilise des emojis modérément.' : ''}
Style: Concis (max 3-4 phrases), amical, professionnel.
⛔ INTERDIT absolu dans TOUTE la réponse : "Je note", "Je retiens", "Je prends note", "J'ai bien noté", "Je note que". Confirme les informations naturellement en les répétant directement et enchaîne avec la prochaine question. Exemples : ✅ "Parfait ! Quelle est votre adresse ?" ✅ "Super, et votre téléphone ?" ❌ "Je note votre nom. Quel est votre téléphone ?"

${hasProducts ? `📢 RÈGLE D'ACCUEIL (CRITIQUE) :
Si le client dit "Salut", "Bonjour", "Menu", "Catalogue" ou commence la conversation par un message vague :
1. Saluer chaleureusement ("Bienvenue chez ${agent.name} ! 👋")
2. AFFICHER LE CATALOGUE (la liste numérotée des produits ci-dessous — noms uniquement)
3. Demander: "${isServiceOnlyAgent ? 'Quelle prestation souhaitez-vous réserver ?' : 'Quel article vous intéresse ? (répondez par nom ou numéro)'}"
⛔ INTERDIT de dire juste "Comment puis-je vous aider ?" sans afficher le catalogue. Tu es un VENDEUR.

🔢 RÈGLE SÉLECTION PRODUIT :
- Si le client répond par un numéro (ex: "1", "2", "le 3") → c'est le produit n°X de la liste affichée.
  Affiche IMMÉDIATEMENT les détails complets : description, prix, variantes/options disponibles.
- Si le client cite directement un produit par son nom → NE PAS réafficher le menu général.
  Affiche directement les détails de ce produit.
- Tolérance fautes : "T-shir", "tshirt", "t shirt" → tous matchent "T-Shirt". Utilise le nom le plus proche.` : `📢 RÈGLE D'ACCUEIL (CATALOGUE VIDE) :
Le catalogue de cette boutique est vide. Aucun produit n'est disponible à la vente.
Si le client dit "Salut", "Bonjour", "Menu", "Catalogue", ou demande un produit ou un prix :
1. Saluer chaleureusement ("Bonjour ! Bienvenue chez ${agent.name} 👋")
2. Répondre EXACTEMENT : "Désolé, aucun produit n'est configuré pour le moment. 😔 Revenez bientôt !"
❌ NE PAS inventer de produits, prix ou catalogue.
❌ NE PAS collecter de commande.`}
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

    // Section 5: Catalogue détaillé (variantes & prix réels — critique anti-hallucination)
    const productsCatalogSection = buildProductsCatalogSection(products, currency)

    // Section 6: Mode de paiement configuré par le marchand
    let paymentSection = ''
    if (!agent.payment_mode || agent.payment_mode === 'cinetpay') {
        paymentSection = `
💳 PAIEMENT EN LIGNE (CinetPay) :
Quand le client choisit "payer en ligne", le système génère automatiquement un lien de paiement sécurisé après create_order.
⚠️ RÈGLE : Transmets le lien de paiement au client EXACTEMENT tel que retourné par le système. Ne l'invente pas.`
    } else if (agent.payment_mode === 'mobile_money_direct') {
        const mmLines = []
        if (agent.mobile_money_orange) mmLines.push(`📱 Orange Money : ${agent.mobile_money_orange}`)
        if (agent.mobile_money_mtn)    mmLines.push(`📱 MTN Money : ${agent.mobile_money_mtn}`)
        if (agent.mobile_money_wave)   mmLines.push(`📱 Wave : ${agent.mobile_money_wave}`)
        if (agent.custom_payment_methods) {
            try {
                const custom = typeof agent.custom_payment_methods === 'string'
                    ? JSON.parse(agent.custom_payment_methods)
                    : agent.custom_payment_methods
                if (Array.isArray(custom)) {
                    custom.forEach(m => mmLines.push(`📱 ${m.name || m.type} : ${m.number}`))
                }
            } catch (_e) {}
        }
        if (mmLines.length > 0) {
            paymentSection = `
💳 PAIEMENT EN LIGNE (Mobile Money Direct) :
Quand le client choisit "payer en ligne", réponds simplement "D'accord, les instructions de paiement vous seront envoyées avec la confirmation de commande."
⚠️ NE PAS lister les numéros ici — ils sont inclus automatiquement dans le message de confirmation. Ne les affiche pas avant la création de la commande.`
        }
    }

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
${businessInfo}
${paymentSection}
${productsCatalogSection}`.trim()
}

module.exports = { buildAdaptiveSystemPrompt }
