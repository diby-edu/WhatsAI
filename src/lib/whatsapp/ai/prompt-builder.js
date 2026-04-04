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
const { prompt_INSCRIPTION } = require('./prompts/workflow-service-inscription')
const { prompt_RESTAURANT } = require('./prompts/workflow-service-restaurant')
const { buildCatalogueSection, buildClientHistory, buildKnowledgeSection, buildProductsCatalogSection } = require('./prompts/sections')

// Mapping des sous-types de services vers les moteurs de template
const SERVICE_ENGINE_MAP = {
    'hotel': 'STAY',
    'residence': 'STAY',
    'restaurant': 'RESTAURANT',
    'event': 'TABLE',
    'rental': 'RENTAL',
    'formation': 'INSCRIPTION',
    'coiffeur': 'SLOT',
    'medecin': 'SLOT',
    'coaching': 'SLOT',
    'prestation': 'SLOT',
    'other': 'SLOT'
}

function buildAdaptiveSystemPrompt(agent, products, orders, relevantDocs, currency, gpsLink, formattedHours, justOrdered = false, userMessage = '', hasKnowledgeBase = false, activeEngineHint = null) {

    // 1. ANALYSE DU CONTEXTE AGENT & PRODUITS
    const serviceProducts = products.filter(p => p.product_type === 'service')
    const isServiceOnlyAgent = (products.length > 0 && serviceProducts.length === products.length)

    // 2. DÉTECTION INTENTION & MOTEUR
    let conversationIntent = 'generic' // 'product_order' (default)
    let activeEngine = null

    if (activeEngineHint) {
        conversationIntent = 'service_booking'
        activeEngine = activeEngineHint
    } else if (isServiceOnlyAgent) {
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

    // MODE SUPPORT CLIENT : aucun produit + base de connaissance → prompt KB-only
    const isServiceFlow = conversationIntent === 'service_booking' && !!activeEngine

    if (products.length === 0 && hasKnowledgeBase) {
        const knowledgeSection = buildKnowledgeSection(relevantDocs)

        // Construire la section paiement manuel (si configurée)
        let supportPaymentLines = []
        if (agent.mobile_money_orange) supportPaymentLines.push(`📱 Orange Money : ${agent.mobile_money_orange}`)
        if (agent.mobile_money_mtn)    supportPaymentLines.push(`📱 MTN Money : ${agent.mobile_money_mtn}`)
        if (agent.mobile_money_wave)   supportPaymentLines.push(`📱 Wave : ${agent.mobile_money_wave}`)
        if (agent.custom_payment_methods) {
            try {
                const custom = typeof agent.custom_payment_methods === 'string'
                    ? JSON.parse(agent.custom_payment_methods)
                    : agent.custom_payment_methods
                if (Array.isArray(custom)) {
                    custom.forEach(m => supportPaymentLines.push(`📱 ${m.name || m.type} : ${m.details || m.number || ''}`))
                }
            } catch (_e) {}
        }
        const supportPaymentSection = supportPaymentLines.length > 0
            ? `\n\n💳 PAIEMENT :\n${supportPaymentLines.join('\n')}`
            : ''

        const escalationRule = agent.escalation_phone
            ? `Si l'info est dans ton domaine mais absente de ta base de connaissance → réponds : "Pour plus de détails, vous pouvez contacter directement au *${agent.escalation_phone}*."
✅ Si la question concerne un service ou sujet hors de ton domaine → réponds poliment que ce n'est pas proposé et redirige vers ce que tu couvres. N'escalade JAMAIS vers le numéro pour quelque chose hors domaine.`
            : `Si l'info est dans ton domaine mais absente de ta base de connaissance → indique poliment que tu n'as pas l'information.
✅ Si la question concerne un service ou sujet hors domaine → réponds poliment que ce n'est pas proposé et redirige vers ce que tu couvres.`

        const agentContext = agent.agent_context ? `\n\n📋 CONTEXTE SUPPLÉMENTAIRE :\n${agent.agent_context}` : ''

        // Règles collecte de leads
        let leadSection = ''
        if (agent.lead_collection_enabled) {
            const fields = Array.isArray(agent.lead_collect_fields)
                ? agent.lead_collect_fields
                : (typeof agent.lead_collect_fields === 'string' ? JSON.parse(agent.lead_collect_fields) : ['name', 'phone'])
            const fieldLabels = fields.map(f => f === 'name' ? 'prénom/nom' : f === 'phone' ? 'numéro de téléphone' : f === 'email' ? 'email' : f).join(', ')
            const redirectMsg = agent.lead_redirect_message || 'Merci ! Nos équipes vous recontacteront très bientôt.'
            leadSection = `

📋 COLLECTE DE LEADS (ACTIF) :
Si le client exprime un intérêt concret (achat, inscription, visite, commande, devis...) :
1. Pose les questions une par une, naturellement : ${fieldLabels}
2. Déduis aussi le sujet d'intérêt (ex: "Formation Excel", "Villa Cocody")
3. Une fois toutes les infos collectées → appelle capture_lead
4. Après l'appel réussi, réponds EXACTEMENT : "${redirectMsg}"
⛔ Ne collecte PAS si le client pose juste une question informative sans intention d'achat/inscription.
⛔ Ne collecte PAS les mêmes infos deux fois dans la même conversation.`
        } else if (agent.lead_redirect_message) {
            leadSection = `

📋 REDIRECTION COMMERCIALE :
Si le client exprime un souhait d'achat, d'inscription ou une demande commerciale → réponds EXACTEMENT :
"${agent.lead_redirect_message}"
Puis ne répète pas ce message si le client continue à poser des questions informatives.`
        }

        return `Tu es l'assistant IA de ${agent.name}.
Langue: ${agent.language || 'français'}.
${agent.use_emojis ? 'Utilise des emojis modérément.' : ''}
Style: Concis (max 3-4 phrases), amical, professionnel.

📚 MODE SUPPORT CLIENT — BASE DE CONNAISSANCE :
Tu réponds UNIQUEMENT à partir de la base de connaissance fournie ci-dessous.
⛔ INTERDIT absolu : inventer, supposer, ou donner une information absente de la base de connaissance.
⛔ INTERDIT absolu : révéler que tu es un bot ou une IA.
RÈGLES DE SALUTATION :
✅ Si le client envoie UNIQUEMENT une salutation (bonjour, salut, bonsoir, hello...) sans exprimer de besoin → réponds EXACTEMENT : "${agent.welcome_message ? agent.welcome_message : `Bonjour ! Je suis l'assistant de ${agent.name}. Comment puis-je vous aider ?`}"
✅ Si le client exprime un besoin directement sans salutation → commence par "Bonjour !" puis réponds immédiatement au besoin. Ne récite pas le message d'accueil.
✅ Si le client salue ET exprime un besoin dans le même message → salutation courte naturelle + réponse au besoin immédiatement. Ne récite pas le message d'accueil.
✅ Si info absente → ${escalationRule}${agentContext}${supportPaymentSection}${leadSection}

${knowledgeSection}`.trim()
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
Si le client dit "Salut", "Bonjour", "Menu", "Carte", "Catalogue" ou commence la conversation par un message vague :
1. Saluer chaleureusement ("Bienvenue chez ${agent.name} ! 👋")
${activeEngine === 'RESTAURANT'
    ? `2. AFFICHER CE MENU PRINCIPAL (exactement, sans modifier) :
   1️⃣ Notre Carte
   2️⃣ Boissons
   3️⃣ Réserver une table
   Tapez un numéro ou décrivez ce que vous souhaitez.
⛔ NE PAS afficher la carte complète ni les prix au premier message.
⛔ NE PAS demander le mode (sur place/emporter/livraison) au premier message.
⛔ SI le client formule déjà une demande précise (ex: "Je veux réserver une table demain à 21h pour 3 personnes avec 2 plats" ou "Je veux commander 2 plats à emporter"), NE RÉAFFICHE PAS le menu principal. Réponds directement à sa demande concrète ou laisse le système structuré poursuivre le parcours.` 
    : `2. AFFICHER LA CARTE / CATALOGUE (noms uniquement)
3. Demander: "${isServiceOnlyAgent ? 'Quelle prestation souhaitez-vous réserver ?' : 'Quel article vous intéresse ? (répondez par nom ou numéro)'}"`}
⛔ INTERDIT de dire juste "Comment puis-je vous aider ?" sans afficher la carte. Tu es un VENDEUR.

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
        else if (activeEngine === 'RESTAURANT') collectOrder = prompt_RESTAURANT
        else if (activeEngine === 'TABLE') collectOrder = prompt_TABLE
        else if (activeEngine === 'SLOT') collectOrder = prompt_SLOT
        else if (activeEngine === 'RENTAL') collectOrder = prompt_RENTAL
        else if (activeEngine === 'INSCRIPTION') collectOrder = prompt_INSCRIPTION
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

    // Section 5: Mission personnalisée (system_prompt du wizard)
    const missionSection = agent.system_prompt && agent.system_prompt.trim()
        ? `\n📋 MISSION DE L'AGENT :\n${agent.system_prompt.trim()}`
        : ''

    // Section 5b: Règles personnalisées (custom_rules du wizard)
    const customRulesSection = agent.custom_rules && agent.custom_rules.trim()
        ? `\n📌 RÈGLES PERSONNALISÉES :\n${agent.custom_rules.trim()}`
        : ''

    // Section 6: Catalogue détaillé (variantes & prix réels — critique anti-hallucination)
    const productsCatalogSection = buildProductsCatalogSection(products, currency)

    // Section 7: Mode de paiement configuré par le marchand
    let paymentSection = ''
    if (isServiceFlow && false) {
        paymentSection = `
ðŸ’³ PAIEMENT POUR LES RÃ‰SERVATIONS DE SERVICE :
- Pour une rÃ©servation de service, utilise TOUJOURS create_booking et JAMAIS create_order.
- Si le service est un hÃ©bergement (STAY) ou une location (RENTAL), collecte aussi payment_method :
  â€¢ "online" = paiement en ligne
  â€¢ "onsite" = paiement sur place / Ã  l'arrivÃ©e / au retrait
- âš ï¸ N'annonce JAMAIS qu'un lien de paiement sera gÃ©nÃ©rÃ© automatiquement aprÃ¨s create_booking, sauf si le systÃ¨me l'a explicitement retournÃ©.`
    } else if (!agent.payment_mode || agent.payment_mode === 'cinetpay') {
        paymentSection = `
💳 LIEN DE PAIEMENT AUTOMATIQUE :
Quand le client choisit "payer en ligne", le système génère automatiquement un lien de paiement sécurisé après create_order.
Le fournisseur actif de la plateforme est utilisé automatiquement.
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
                    custom.forEach(m => mmLines.push(`📱 ${m.name || m.type} : ${m.details || m.number || ''}`))
                }
            } catch (_e) {}
        }
        if (mmLines.length > 0) {
            paymentSection = `
💳 PAIEMENT MANUEL :
Quand le client choisit "payer en ligne", réponds simplement "D'accord, les instructions de paiement vous seront envoyées avec la confirmation de commande."
⚠️ NE PAS lister les numéros ici — ils sont inclus automatiquement dans le message de confirmation. Ne les affiche pas avant la création de la commande.`
        }
    }

    if (isServiceFlow && activeEngine !== 'RESTAURANT') {
        paymentSection = `
PAIEMENT POUR LES RESERVATIONS DE SERVICE :
- Pour une reservation de service, utilise TOUJOURS create_booking et JAMAIS create_order.
- Si le service est un hebergement (STAY) ou une location (RENTAL), collecte aussi payment_method :
  - "online" = paiement en ligne
  - "onsite" = paiement sur place / a l'arrivee / au retrait
- N'annonce jamais qu'un lien de paiement sera genere automatiquement apres create_booking, sauf si le systeme l'a explicitement retourne.`
    }

    // 4. ASSEMBLAGE FINAL
    return `${resetContext}
${variantsRules}
${identity}
${missionSection}
${catalogueSection}
${collectOrder}
${antiLoopRules}
${customRulesSection}
${toolsDefinition}
${clientHistory}
${knowledgeSection}
${businessInfo}
${paymentSection}
${productsCatalogSection}`.trim()
}

module.exports = { buildAdaptiveSystemPrompt }
