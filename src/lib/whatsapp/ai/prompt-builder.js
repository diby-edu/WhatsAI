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

function getOrderableProducts(products = []) {
    return (products || []).filter(product => product?.product_type !== 'service')
}

function isDigitalOnlyCatalog(products = []) {
    const orderableProducts = getOrderableProducts(products)
    return products.length > 0 &&
        orderableProducts.length === products.length &&
        orderableProducts.every(product => product?.product_type === 'digital')
}

function buildCatalogConsistencySection(products = []) {
    if (!isDigitalOnlyCatalog(products)) {
        return ''
    }

    return `
COHERENCE METIER DU CATALOGUE (PRIORITE ABSOLUE) :
- Ce catalogue vend uniquement des produits numeriques.
- Ignore toute ancienne instruction parlant d'adresse de livraison, de cash a la livraison, de delai de livraison, ou de choix libre du mode de paiement.
- Pour finaliser une commande numerique, collecte uniquement : produits/quantites, nom complet, telephone, email.
- Ne demande jamais d'adresse de livraison physique.
- Pour les produits numeriques, payment_method est TOUJOURS "online".
- N'annonce jamais "cash a la livraison" pour un produit numerique.
- Si le client demande comment payer, explique simplement que le paiement se fera a distance selon le mode configure par le systeme apres confirmation.
`.trim()
}

// Cote d'Ivoire (+225) uniquement : regroupe les 10 chiffres locaux par paires
// (+2250102108216 -> +225 01 02 10 82 16). Pour tout autre indicatif, on ne
// devine pas sa longueur (variable selon les pays) — retourne le numero tel quel.
function formatPhoneWithSpaces(phone) {
    if (!phone) return phone
    const trimmed = String(phone).trim()
    const match = trimmed.match(/^\+225(\d{10})$/)
    if (!match) return trimmed
    const pairs = match[1].match(/.{1,2}/g) || []
    return `+225 ${pairs.join(' ')}`
}

function buildWelcomeInteractionHint(agent) {
    const baseLine = 'Pour une meilleure prise en charge, vous pouvez repondre directement a la question affichee.'
    if (agent?.escalation_phone) {
        return `${baseLine}\nPour toute autre demande, contactez le service client au ${formatPhoneWithSpaces(agent.escalation_phone)}.`
    }

    return baseLine
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

        if (matchedProduct && matchedProduct.product_type === 'service' && matchedProduct.service_subtype) {
            // console.log(`🧠 INTENT DETECTED: ${matchedProduct.name} -> ${matchedProduct.service_subtype}`)
            conversationIntent = 'service_booking'
            activeEngine = SERVICE_ENGINE_MAP[matchedProduct.service_subtype] || 'SLOT'
        }
    }

    // MODE SUPPORT CLIENT : aucun produit + base de connaissance → prompt KB-only
    const isServiceFlow = conversationIntent === 'service_booking' && !!activeEngine

    if (products.length === 0 && !hasKnowledgeBase) {
        // Support sans KB : prompt basé sur system_prompt uniquement
        // (évite le message "aucun produit configuré" destiné aux e-commerce)
        const contactSuffix = agent.fallback_contact_message
            ? ` ${agent.fallback_contact_message}`
            : agent.escalation_phone
                ? ` Pour plus de détails, vous pouvez contacter directement au *${agent.escalation_phone}*.`
                : ''

        const agentContext = agent.agent_context ? `\n\n📋 CONTEXTE SUPPLÉMENTAIRE :\n${agent.agent_context}` : ''

        const genericFallback = agent.fallback_contact_message
            || (agent.escalation_phone ? `Pour toute question, contactez-nous directement au *${agent.escalation_phone}*.` : `Pour toute question, veuillez contacter directement l'équipe de ${agent.name}.`)

        return `Tu es l'assistant IA de ${agent.name}.
Langue: ${agent.language || 'français'}.
${agent.use_emojis ? 'Utilise des emojis modérément.' : ''}
Style: Concis (max 3-4 phrases), amical, professionnel.
⛔ INTERDIT absolu : révéler que tu es un bot ou une IA.
⛔ INTERDIT : "Je note", "Je retiens", "J'ai bien noté".
⛔ INTERDIT : inventer ou supposer une information que tu n'as pas.
${agentContext}

${agent.system_prompt ? agent.system_prompt : ''}

RÈGLES DE SALUTATION :
✅ Si le client envoie UNIQUEMENT une salutation → réponds EXACTEMENT : "${agent.welcome_message || `Bonjour ! Je suis l'assistant de ${agent.name}. Comment puis-je vous aider ?`}"
✅ Si le client exprime un besoin ou pose une question → réponds EXACTEMENT : "${genericFallback}"
✅ Ne développe jamais une réponse à partir de tes connaissances générales.`.trim()
    }

    if (products.length === 0 && hasKnowledgeBase) {
        // Passer TOUS les docs sans limitation (maxDocs = null)
        const knowledgeSection = buildKnowledgeSection(relevantDocs, null)

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

        // Message de contact configurable (2e phrase quand info absente)
        const contactSuffix = agent.fallback_contact_message
            ? ` ${agent.fallback_contact_message}`
            : agent.escalation_phone
                ? ` Pour plus de détails, vous pouvez contacter directement au *${agent.escalation_phone}*.`
                : ''

        const escalationRule = `Si le client pose une question dont la réponse N'EST PAS dans ta base de connaissance → réponds honnêtement que tu n'as pas cette information précise.${contactSuffix}
✅ Si la question concerne un sujet totalement hors de ton domaine (ex: religion, politique, images personnelles...) → ignore poliment le contenu et ramène la conversation à ton domaine : "Je suis l'assistant de ${agent.name}, je suis là pour vous aider sur [domaine]. Comment puis-je vous aider ?"
⛔ Ne fournis JAMAIS le numéro de contact pour des questions hors domaine.
⛔ Si un client envoie une image sans rapport avec ton domaine → ne commente PAS l'image. Redirige vers ton domaine.`

        const agentContext = agent.agent_context ? `\n\n📋 CONTEXTE SUPPLÉMENTAIRE :\n${agent.agent_context}` : ''

        // Règles collecte de leads
        let leadSection = ''
        if (agent.lead_collection_enabled) {
            const fields = Array.isArray(agent.lead_collect_fields)
                ? agent.lead_collect_fields
                : (typeof agent.lead_collect_fields === 'string' ? JSON.parse(agent.lead_collect_fields) : ['name', 'phone'])

            const FIELD_LABELS = {
                name: 'prénom/nom',
                phone: 'numéro de téléphone',
                email: 'email',
                location: 'localisation/quartier',
                company: 'entreprise',
                preferred_date: 'date souhaitée',
                preferred_time: 'heure souhaitée',
                service_requested: 'service ou prestation souhaité',
                notes: 'informations complémentaires',
            }
            const standardLabels = fields.map(f => FIELD_LABELS[f] || f)

            // Champs personnalisés définis par le marchand
            const customFields = Array.isArray(agent.lead_custom_fields)
                ? agent.lead_custom_fields
                : (typeof agent.lead_custom_fields === 'string' ? JSON.parse(agent.lead_custom_fields || '[]') : [])

            const allFieldLabels = [...standardLabels, ...customFields].join(', ')

            const customFieldsInstruction = customFields.length > 0
                ? `\n5. Champs personnalisés à collecter : ${customFields.join(', ')} → stocke-les dans custom_fields`
                : ''

            const redirectMsg = agent.lead_redirect_message || 'Merci ! Nos équipes vous recontacteront très bientôt.'
            leadSection = `

📋 COLLECTE DE LEADS (ACTIF) :
Si le client exprime un intérêt concret (achat, inscription, visite, rendez-vous, devis, service...) :
1. Pose les questions une par une, naturellement : ${allFieldLabels}
2. Déduis aussi le sujet d'intérêt/service demandé
3. Une fois toutes les infos collectées → appelle capture_lead${customFieldsInstruction}
4. Après l'appel réussi, réponds EXACTEMENT : "${redirectMsg}"
⛔ Ne collecte PAS si le client pose juste une question informative sans intention concrète.
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
    const welcomeInteractionHint = buildWelcomeInteractionHint(agent)
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
    : `2. Dire "Voici nos articles :" puis reproduire EXACTEMENT la liste numérotée de la section CATALOGUE ci-dessous (gras, emoji 💰 et montants inclus, sans rien reformuler ni recalculer).
3. Demander: "${isServiceOnlyAgent ? 'Quelle prestation souhaitez-vous réserver ?' : 'Quel article vous intéresse ? (répondez par son nom ou son numéro)'}"
4. AJOUTER ce texte, exactement (avec le retour à la ligne) : "${welcomeInteractionHint}"`}
⛔ INTERDIT de dire juste "Comment puis-je vous aider ?" sans afficher la carte. Tu es un VENDEUR.

🔢 RÈGLE SÉLECTION PRODUIT :
- Cette règle s'applique UNIQUEMENT quand tu viens de demander "Quel article vous intéresse ?". PAS pendant le checkout (collecte d'infos, confirmation, récapitulatif).
- Si le client répond par un numéro (ex: "1", "2", "le 3") → c'est le produit n°X de la liste affichée.
  Affiche IMMÉDIATEMENT les détails complets : description, prix, variantes/options disponibles.
- Si le client cite directement un produit par son nom → NE PAS réafficher le menu général.
  Affiche directement les détails de ce produit.
- Tolérance fautes : "T-shir", "tshirt", "t shirt" → tous matchent "T-Shirt". Utilise le nom le plus proche.
⛔ PENDANT LE CHECKOUT : un numéro est un CHOIX DE MENU (oui/continuer/modifier), JAMAIS une sélection de produit. Ne pas réinitialiser le panier.` : `📢 RÈGLE D'ACCUEIL (CATALOGUE VIDE) :
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
        else collectOrder = buildGenericWorkflow(orders, products, agent) // Fallback
    } else {
        collectOrder = buildGenericWorkflow(orders, products, agent) // Default Generic/Mixed
    }

    // Section 4: Contexte & Business Info
    const clientHistory = buildClientHistory(orders)
    const knowledgeSection = buildKnowledgeSection(relevantDocs, 3)

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
        ? `\n📌 RÈGLES PERSONNALISÉES :\n${agent.custom_rules.trim()}\n⚠️ PRIORITÉ : si ces règles personnalisées contredisent les frais de livraison ou le mode de paiement configurés (indiqués ailleurs dans ce prompt), ce sont TOUJOURS ces informations structurées qui font foi — ignore toute mention contraire ici.`
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
${buildCatalogConsistencySection(products)}
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

module.exports = { buildAdaptiveSystemPrompt, SERVICE_ENGINE_MAP }
