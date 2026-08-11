/**
 * ═══════════════════════════════════════════════════════════════
 * GENERATOR.JS v2.7 - VERSION CONSOLIDÉE (AUDIT COMPLET)
 * ═══════════════════════════════════════════════════════════════
 * 
 * CORRECTIONS INCLUSES :
 * ✅ #2 : Pre-check valide les OPTIONS (pas juste les clés)
 * ✅ #7 : Retry avec backoff exponentiel pour OpenAI
 * ✅ Logs de debug complets
 * ✅ Import findMatchingOption depuis tools.js
 */

const { TOOLS, handleToolCall, findMatchingOption, getOptionValue, productHasRealVariants, VARIANT_CATEGORY_LABELS } = require('./tools')
const { findRelevantDocuments } = require('./rag')
const { verifyResponseIntegrity } = require('../utils/security')
const { buildAdaptiveSystemPrompt } = require('./prompt-builder')
const {
    buildCheckoutStateGuidance,
    mergeCheckoutStateIntoToolArgs,
} = require('../services/checkout-state.service')
const {
    buildCartStateGuidance,
    mergeCartStateIntoToolArgs,
} = require('../services/cart-state.service')
const {
    buildBookingStateGuidance,
    mergeBookingStateIntoToolArgs,
} = require('../services/booking-state.service')
const {
    buildRestaurantStateGuidance,
    hasRestaurantStateData,
    mergeRestaurantStateIntoToolArgs,
} = require('../services/restaurant-state.service')

// Configuration
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Sleep helper pour retry
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Supprime les doublons texte/caption après envoi d'image.
 * Si l'IA génère "Voici Tecno Camon 20 !" alors que la caption dit déjà "Voici Tecno Camon 20 !",
 * on retire cette répétition du texte.
 */
function stripImageDoublons(content, imageActions) {
    if (!content || !imageActions || imageActions.length === 0) return content
    let cleaned = content
    for (const img of imageActions) {
        const caption = (img.caption || '').trim()
        const productName = (img.product_name || '').trim()
        // Retirer la caption exacte si elle apparaît en début de texte
        if (caption) {
            const escaped = caption.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            cleaned = cleaned.replace(new RegExp(`^\\s*${escaped}\\s*[!.]?\\s*`, 'i'), '').trim()
        }
        // Retirer "Voici [nom]" / "Voici le [nom]" / "Voici la [nom]"
        if (productName) {
            const escapedName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            cleaned = cleaned.replace(
                new RegExp(`Voici\\s+(?:le\\s+|la\\s+|l')?${escapedName}\\s*[!.]?`, 'gi'),
                ''
            ).trim()
        }
    }
    return cleaned.trim()
}

/**
 * Supprime les images/liens markdown générés par l'IA à la place du tool send_image.
 * Couvre : ![alt](url) et [texte](url_image)
 */
/**
 * Filet de sécurité mode lead_only : le prompt interdit déjà toute mention de
 * paiement en ligne / lien de paiement (le total est une estimation, jamais un
 * encaissement), mais cette règle n'est pas toujours suivie par le modèle.
 * Retire uniquement la/les phrase(s) fautive(s), sans toucher au reste du message.
 */
function stripLeadOnlyPaymentMentions(content, isLeadOnlyMode) {
    if (!isLeadOnlyMode || !content) return content

    const forbiddenPatterns = [
        /lien de paiement/i,
        /paiement s[ée]curis[ée]/i,
        /payer en ligne/i,
        /paiement en ligne/i,
        /payer\s.{0,20}(en ligne|à la livraison|a la livraison)/i,
        /mode de paiement/i,
    ]

    // Découpe par ligne (les récaps lead_only structurent une info par ligne) plutôt
    // que par phrase — un récap n'a souvent aucun point avant la question finale,
    // ce qui ferait retirer tout le bloc au lieu de la seule ligne fautive.
    const lines = content.split('\n')
    const cleaned = lines.filter(line => !forbiddenPatterns.some(re => re.test(line)))

    const result = cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    if (result !== content.trim()) {
        console.log('⚠️ [lead_only] Mention de paiement interdite retirée de la réponse IA')
    }
    return result
}

/**
 * Filet de sécurité mode lead_only : l'ÉTAPE 5 du workflow donne un GABARIT de récap
 * de clôture ("*• Nom : <valeur>*"). Observé en prod : le modèle recopie ce gabarit
 * sans le remplir, et le client reçoit littéralement "<valeur>" sur WhatsApp — alors
 * qu'il n'a encore donné ni nom ni téléphone.
 *
 * Deux dégâts : le message est incompréhensible pour le client, ET le bloc
 * "*Vos coordonnées :*" déclenche le filet capture_lead plus bas, qui enregistre un
 * lead vide avant que le client ait rien fourni.
 *
 * On retire donc le bloc de clôture entier quand il contient un champ non rempli. Le
 * reste du message (récap chiffré, question de collecte) est conservé intact — c'est
 * justement la question qu'il fallait poser.
 */
const LEAD_ONLY_PLACEHOLDER = /<\s*valeur\s*>|\[\s*(?:valeur|non\s+fourni|non\s+renseign[ée]|manquant[e]?|à\s+compléter)\s*\]/i

function stripLeadOnlyUnfilledRecap(content, isLeadOnlyMode) {
    if (!isLeadOnlyMode || !content || !LEAD_ONLY_PLACEHOLDER.test(content)) return content

    const lines = content.split('\n')
    const kept = []
    let insideCoordinatesBlock = false

    for (const line of lines) {
        if (/^\s*\*?\s*Vos coordonnées\s*:/i.test(line)) {
            insideCoordinatesBlock = true
            continue
        }
        if (insideCoordinatesBlock) {
            // Le bloc court jusqu'à la première ligne qui n'est plus une puce de champ.
            if (/^\s*$/.test(line) || /^\s*\*?\s*[•\-]/.test(line)) continue
            insideCoordinatesBlock = false
        }
        if (LEAD_ONLY_PLACEHOLDER.test(line)) continue
        kept.push(line)
    }

    const result = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    console.log('⚠️ [lead_only] Récap de clôture non rempli (<valeur>) retiré de la réponse IA')
    return result
}

/**
 * Une question de quantité portant sur un article dont la quantité est DÉJÀ connue est
 * prouvablement fausse : l'information existe dans lead_state, elle a été affichée à l'IA,
 * et la reposer fait répéter le client ("J'ai dis 10", observé en prod).
 *
 * Quatre règles de prompt successives n'ont pas suffi à l'éliminer — il reste ~20 % des
 * réponses. On détecte donc le cas par code, comme preCheckCreateOrder rejette un appel
 * d'outil invalide. Ce détecteur ne CHOISIT PAS la question suivante : il constate qu'une
 * question précise est impossible et laisse l'IA reformuler librement.
 *
 * Ciblage strict pour éviter les faux positifs : on n'examine que la phrase interrogative
 * contenant la demande de quantité, et on ne la rejette QUE si elle nomme un article
 * complet SANS nommer d'article dont la quantité manque réellement (cas légitime :
 * "10 sacs noirs, c'est noté. Pour les gourdes rouges, quelle quantité ?").
 */
const QUANTITY_QUESTION = /(quelle\s+(?:est\s+la\s+)?quantit[ée]|combien\s+(?:en\s+|de\s+)?(?:voulez|souhaitez|d[ée]sirez)|combien\s+de\s+|nombre\s+(?:de|d')\s*\w+\s+souhait)/i

function findStaleQuantityQuestion(content, leadState) {
    if (!content || !leadState || !Array.isArray(leadState.items)) return null

    const known = leadState.items.filter(item => item.quantity !== null && item.product_name)
    const stillMissing = leadState.items.filter(item => item.quantity === null && item.product_name)
    if (known.length === 0) return null

    const mentions = (sentence, name) => {
        // Compare sur le premier mot significatif du nom produit ("sac" pour "sac enfant") —
        // l'IA écrit "sacs enfants", "sac enfant Noir", rarement le nom exact du catalogue.
        const head = String(name).trim().split(/\s+/)[0]
        if (!head || head.length < 3) return false
        return new RegExp(`\\b${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i').test(sentence)
    }

    for (const sentence of content.split(/(?<=[?!.])\s+|\n/)) {
        if (!QUANTITY_QUESTION.test(sentence)) continue
        if (stillMissing.some(item => mentions(sentence, item.product_name))) continue
        const target = known.find(item => mentions(sentence, item.product_name))
        if (target) return { sentence: sentence.trim(), item: target }
    }
    return null
}

function stripMarkdownImages(content) {
    if (!content) return content
    // Supprimer ![alt](url)
    let cleaned = content.replace(/!\[[^\]]*\]\(https?:\/\/[^)]+\)/g, '')
    // Supprimer [texte](url) pointant vers une image
    cleaned = cleaned.replace(
        /\[[^\]]+\]\(https?:\/\/[^)]+\.(?:jpg|jpeg|png|gif|webp)[^)]*\)/gi,
        ''
    )
    // Supprimer les labels d'énumération d'images générés par l'IA
    // ex: "Voici la première image :", "Et voici la 2ème image :", "Voici l'image suivante :"
    cleaned = cleaned.replace(
        /(?:et\s+)?voici\s+(?:la\s+)?(?:première|deuxième|troisième|quatrième|[\d]+[eè]?me?|l['']image\s+suivante|une?\s+(?:autre\s+)?image?)\s*(?:image\s*)?:/gi,
        ''
    )
    // Nettoyer les lignes vides consécutives laissées par les suppressions
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
    return cleaned
}

function detectServiceEngine(products = [], userMessage = '') {
    const serviceProducts = products.filter(product => product.product_type === 'service')
    if (serviceProducts.length === 0) {
        return null
    }

    const isServiceOnlyAgent = products.length > 0 && serviceProducts.length === products.length
    if (isServiceOnlyAgent) {
        const subtype = serviceProducts[0]?.service_subtype || 'other'
        if (subtype === 'restaurant') return 'RESTAURANT'
        return null
    }

    const lowerMessage = String(userMessage || '').toLowerCase()
    const matchedProduct = products
        .filter(product => lowerMessage.includes(String(product.name || '').toLowerCase()))
        .sort((a, b) => String(b.name || '').length - String(a.name || '').length)[0]

    if (matchedProduct?.product_type === 'service' && matchedProduct?.service_subtype === 'restaurant') {
        return 'RESTAURANT'
    }

    return null
}

function hasRestaurantServiceProduct(products = []) {
    return (products || []).some(
        product => product?.product_type === 'service' && product?.service_subtype === 'restaurant'
    )
}

/**
 * 🔍 PRE-CHECK AMÉLIORÉ v2.7
 * Vérifie que les variantes ET leurs valeurs sont valides
 */
function preCheckCreateOrder(toolCall, products) {
    if (toolCall.function.name !== 'create_order') {
        return { valid: true }
    }

    try {
        const args = JSON.parse(toolCall.function.arguments)

        // Log détaillé
        console.log('═══════════════════════════════════════════════')
        console.log('🔍 PRE-CHECK create_order')
        console.log(JSON.stringify(args, null, 2))
        console.log('═══════════════════════════════════════════════')

        if (!args.items || !Array.isArray(args.items)) {
            console.log('❌ PRE-CHECK: items manquants')
            return { valid: false, error: 'Items manquants dans la requête' }
        }

        for (const item of args.items) {
            console.log(`📦 Vérification: "${item.product_name}" x${item.quantity}`)
            console.log(`   selected_variants:`, item.selected_variants || '❌ NON FOURNI')

            // Trouver le produit
            const productName = item.product_name?.toLowerCase() || ''
            const product = products.find(p => {
                const pName = p.name.toLowerCase()
                return pName === productName ||
                    productName.includes(pName) ||
                    pName.includes(productName)
            })

            if (!product) {
                console.log(`   ⚠️ Produit non trouvé - sera géré par handleToolCall`)
                continue
            }

            console.log(`   ✅ Produit: "${product.name}"`)

            // Vérifier les variantes
            if (productHasRealVariants(product)) {
                console.log(`   📋 Variantes requises: ${product.variants.map(v => v.name).join(', ')}`)

                const selectedVariants = item.selected_variants || {}

                for (const variant of product.variants) {
                    if (!variant.options || !Array.isArray(variant.options) || variant.options.length === 0) {
                        continue
                    }

                    // Les suppléments/additifs sont optionnels : on ne bloque jamais create_order
                    // si le client n'en a pas choisi.
                    if (variant.type === 'additive' || variant.type === 'supplement') {
                        console.log(`   ℹ️ ${variant.name}: supplément optionnel, non bloquant`)
                        continue
                    }

                    const variantName = variant.name
                    const variantNameLower = variantName.toLowerCase()

                    // Chercher la clé correspondante avec validation par valeur.
                    // Quand plusieurs groupes partagent le même name (ex: deux "Couleur"),
                    // on identifie le bon groupe en vérifiant que la valeur est valide dedans.
                    const catLabel = (VARIANT_CATEGORY_LABELS[variant.category] || '').toLowerCase()
                    const selectedEntry = Object.entries(selectedVariants).find(([k, v]) => {
                        const kLower = k.toLowerCase()
                        const keyMatch = kLower === variantNameLower || (catLabel && kLower === catLabel)
                        return keyMatch && !!findMatchingOption(variant, v)
                    })

                    if (!selectedEntry) {
                        const options = variant.options.map(o => getOptionValue(o)).join(', ')
                        console.log(`   ❌ Variante "${variantName}" MANQUANTE ou valeur invalide`)

                        return {
                            valid: false,
                            error: `Variante "${variantName}" absente ou invalide dans selected_variants. ` +
                                `Le client l'a déjà précisée dans la conversation : retrouve la valeur et rappelle create_order IMMÉDIATEMENT. ` +
                                `NE REDEMANDE PAS au client. Options valides : ${options}.`
                        }
                    }

                    const selectedValue = selectedEntry[1]
                    const validOption = findMatchingOption(variant, selectedValue)
                    const matchedValue = getOptionValue(validOption)
                    console.log(`   ✅ ${variantName}: "${selectedValue}" → "${matchedValue}"`)
                }
            } else {
                console.log(`   ℹ️ Pas de variantes requises`)
            }
        }

        console.log('✅ PRE-CHECK PASSED')
        return { valid: true }

    } catch (e) {
        console.error('❌ PRE-CHECK ERROR:', e.message)
        return { valid: true } // En cas d'erreur de parsing, laisser handleToolCall gérer
    }
}

function hydrateToolCallArguments(toolCall, checkoutState, cartState, bookingState, restaurantState, customerPhone) {
    try {
        const parsedArgs = JSON.parse(toolCall.function.arguments)

        // find_order : injecter le téléphone WhatsApp si l'IA n'en a pas fourni
        if (toolCall.function.name === 'find_order' && !parsedArgs.phone_number && customerPhone) {
            parsedArgs.phone_number = customerPhone
        }

        const mergedCheckoutArgs = mergeCheckoutStateIntoToolArgs(toolCall.function.name, parsedArgs, checkoutState)
        const mergedCartArgs = mergeCartStateIntoToolArgs(toolCall.function.name, mergedCheckoutArgs, cartState)
        const mergedBookingArgs = mergeBookingStateIntoToolArgs(toolCall.function.name, mergedCartArgs, bookingState)
        const mergedArgs = mergeRestaurantStateIntoToolArgs(toolCall.function.name, mergedBookingArgs, restaurantState)

        return {
            ...toolCall,
            function: {
                ...toolCall.function,
                arguments: JSON.stringify(mergedArgs)
            }
        }
    } catch {
        return toolCall
    }
}

function formatDirectToolResponse(parsedResult) {
    const parts = []

    if (parsedResult.items) parts.push(parsedResult.items)
    if (parsedResult.message) parts.push(parsedResult.message)

    return parts.filter(Boolean).join('\n\n')
}

/**
 * Appel OpenAI avec retry
 */
async function callOpenAIWithRetry(openai, params, maxRetries = MAX_RETRIES) {
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const completion = await openai.chat.completions.create(params)
            return completion
        } catch (error) {
            lastError = error
            console.log(`⚠️ OpenAI attempt ${attempt}/${maxRetries} failed:`, error.message)

            // Ne pas retry si c'est une erreur de contenu (pas réseau)
            if (error.code === 'content_filter' || error.code === 'invalid_api_key') {
                throw error
            }

            if (attempt < maxRetries) {
                const delay = RETRY_DELAY_MS * attempt
                console.log(`   ⏳ Retry in ${delay}ms...`)
                await sleep(delay)
            }
        }
    }

    throw lastError
}

/**
 * Generate AI Response v2.7
 */
async function generateAIResponse(options, dependencies) {
    const { openai, supabase, activeSessions, CinetPay } = dependencies

    let imageActions = []  // Collecter les images à envoyer

    try {
        const {

            agent,
            conversationHistory,
            userMessage,
            products,
            orders,
            customerPhone,
            conversationId,
            currency = 'USD',
            checkoutState,
            cartState,
            cartQuestionDetected = false,
            checkoutQuestionDetected = false,
            bookingState,
            restaurantState,
            restaurantQuestionDetected = false,
            hasKnowledgeBase = false,
            leadStateSummary = null,
            leadState = null
        } = options

        // RAG - Documents pertinents
        let relevantDocs = await findRelevantDocuments(openai, supabase, agent.id, userMessage)

        // Data Sync API — ajouter les données externes synchronisées (produits, FAQ, etc.)
        // Guard strict : si table absente ou erreur → aucun impact sur le flux existant
        let hasExternalData = false
        try {
            const { data: externalData } = await supabase
                .from('agent_external_data')
                .select('data_type, external_id, data')
                .eq('agent_id', agent.id)
                .limit(100)
            if (externalData && externalData.length > 0) {
                const extraDocs = externalData.map(entry => {
                    const d = entry.data || {}
                    const lines = []
                    if (d.name) lines.push(d.name)
                    if (d.description) lines.push(d.description)
                    if (d.price !== undefined) lines.push(`Prix : ${d.price}`)
                    if (d.stock !== undefined) lines.push(`Stock : ${d.stock}`)
                    const reserved = new Set(['name', 'description', 'price', 'stock'])
                    Object.entries(d).forEach(([k, v]) => {
                        if (!reserved.has(k) && v !== null && v !== undefined && typeof v !== 'object') {
                            lines.push(`${k} : ${v}`)
                        }
                    })
                    return { content: lines.filter(Boolean).join(' — ') }
                }).filter(doc => doc.content.length > 0)
                relevantDocs = [...(relevantDocs || []), ...extraDocs]
                hasExternalData = extraDocs.length > 0 && agent.ecommerce_mode === 'external_sync'
            }
        } catch (_) {
            // Silencieux — le RAG normal fonctionne sans les données externes
        }

        // Live Query API — appel sortant en temps réel (stock, statut commande, etc.)
        // Guard strict : timeout 3s, fail silencieux, zéro impact si absent
        if (agent.live_query_url) {
            try {
                const lqBody = JSON.stringify({
                    customer_phone: customerPhone,
                    message: userMessage,
                    conversation_id: conversationId,
                    agent_id: agent.id,
                })

                const headers = { 'Content-Type': 'application/json' }

                // Signature HMAC-SHA256 optionnelle si live_query_secret configuré
                if (agent.live_query_secret) {
                    const { createHmac } = require('node:crypto')
                    const sig = createHmac('sha256', agent.live_query_secret).update(lqBody).digest('hex')
                    headers['X-Wazzap-Signature'] = `sha256=${sig}`
                }

                const controller = new AbortController()
                const lqTimeout = setTimeout(() => controller.abort(), 3000)

                const lqResponse = await fetch(agent.live_query_url, {
                    method: 'POST',
                    headers,
                    body: lqBody,
                    signal: controller.signal,
                })
                clearTimeout(lqTimeout)

                if (lqResponse.ok) {
                    const lqData = await lqResponse.json().catch(() => null)
                    if (lqData) {
                        const lqContent = lqData.answer
                            || (lqData.data ? JSON.stringify(lqData.data) : null)
                            || (lqData.result ? JSON.stringify(lqData.result) : null)
                        if (lqContent) {
                            relevantDocs = [...(relevantDocs || []), {
                                content: `[Données temps réel]: ${lqContent}`
                            }]
                        }
                    }
                }
            } catch (_) {
                // Timeout ou erreur réseau → l'agent répond sans live data
            }
        }

        // Formater les horaires
        let formattedHours = 'Non spécifiés'
        if (agent.business_hours) {
            try {
                const hoursObj = typeof agent.business_hours === 'string'
                    ? JSON.parse(agent.business_hours)
                    : agent.business_hours

                const dayMap = {
                    monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
                    thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche'
                }

                formattedHours = Object.entries(hoursObj).map(([dayKey, schedule]) => {
                    const dayName = dayMap[dayKey] || dayKey
                    if (schedule.closed) return `${dayName}: Fermé`
                    return `${dayName}: ${schedule.open} - ${schedule.close}`
                }).join('\n  ')
            } catch (_e) {
                formattedHours = String(agent.business_hours)
            }
        }

        // Lien GPS
        const gpsLink = (agent.latitude && agent.longitude)
            ? `https://www.google.com/maps?q=${agent.latitude},${agent.longitude}`
            : ''

        // 3. Construire le System Prompt
        // external_sync : produits dans agent_external_data (pas dans products) → jamais support client
        const isSupportClientMode = (products || []).length === 0 && hasKnowledgeBase && agent.ecommerce_mode !== 'external_sync'
        // Mode Lead Only : catalogue conservé (produits/images/variantes), mais aucun outil
        // transactionnel — la conversation se termine par capture_lead au lieu de create_order.
        const isLeadOnlyMode = agent.conversation_mode === 'lead_only'
        const activeEngineHint =
            hasRestaurantServiceProduct(products || []) && hasRestaurantStateData(restaurantState)
                ? 'RESTAURANT'
                : null
        // external_sync : les produits externes dans relevantDocs jouent le rôle de KB
        const effectiveHasKnowledgeBase = hasKnowledgeBase || hasExternalData
        let systemPrompt = buildAdaptiveSystemPrompt(
            agent,
            products || [],
            orders || [],
            relevantDocs || [],
            currency,
            options.gpsLink || gpsLink || '',
            options.formattedHours || formattedHours || 'Non spécifiés',
            options.justOrdered || false, // Passer le flag de reset
            userMessage || '', // v2.19: Intent Detection Context
            effectiveHasKnowledgeBase,
            activeEngineHint
        )
        if (isLeadOnlyMode && leadStateSummary) {
            systemPrompt += `\n\nARTICLES DÉJÀ IDENTIFIÉS (source système, prioritaire — ne redemande jamais une quantité ou variante déjà connue ici, ne recalcule rien toi-même, utilise ces valeurs exactes dans preview_cart) :\n${leadStateSummary}`
        }
        if (!isSupportClientMode) {
            const checkoutStateGuidance = buildCheckoutStateGuidance(checkoutState, {
                questionDetected: checkoutQuestionDetected,
                escalationPhone: agent.escalation_phone || null,
            })
            if (checkoutStateGuidance) {
                systemPrompt += '\n\n' + checkoutStateGuidance
            }
            const cartStateGuidance = buildCartStateGuidance(cartState, products || [], {
                questionDetected: cartQuestionDetected,
                escalationPhone: agent.escalation_phone || null,
            })
            if (cartStateGuidance) {
                systemPrompt += '\n\n' + cartStateGuidance
            }
            const bookingStateGuidance = buildBookingStateGuidance(
                bookingState,
                (products || []).filter(product => product.product_type === 'service' && product.service_subtype !== 'restaurant')
            )
            if (bookingStateGuidance) {
                systemPrompt += '\n\n' + bookingStateGuidance
            }
            const restaurantStateGuidance = buildRestaurantStateGuidance(restaurantState, { questionDetected: restaurantQuestionDetected, escalationPhone: agent.escalation_phone || null })
            if (restaurantStateGuidance) {
                systemPrompt += '\n\n' + restaurantStateGuidance
            }
        }
        // Injecter la règle de salutation si c'est le premier message
        const isFirstMessage = !conversationHistory || conversationHistory.filter(m => m.role === 'user').length === 0
        if (isFirstMessage) {
            systemPrompt += '\n\n📌 PREMIER MESSAGE : Le client t\'écrit pour la première fois. Commence OBLIGATOIREMENT par le saluer chaleureusement (ex: "Bonjour ! 😊") avant de répondre à sa demande.'
        }

        // Injection dynamique si le message contient une demande d'image
        const hasImageKeyword = /\b(montre[z]?|photo[s]?|image[s]?|voir|affiche[z]?)\b/i.test(userMessage || '')
        if (hasImageKeyword) {
            systemPrompt += '\n\n🚨 RAPPEL URGENT IMAGE : Ce message contient une demande d\'image. Règle STRICTE : appelle send_image UNIQUEMENT pour le(s) produit(s) où "image", "photo" ou "montrez" est explicitement demandé. Pour les questions "prix [produit]" → réponds UNIQUEMENT avec le prix en texte, AUCUNE image.\n⚠️ RÈGLE CRITIQUE KB IMAGES : Si la section INFOS UTILES contient [IMAGES DISPONIBLES], tu DOIS utiliser le product_name ET le image_url EXACTS listés dans cette section — jamais le nom du produit catalogue. Ex : client demande "robe verte" → KB liste product_name="robe verte" image_url="https://..." → appelle send_image(product_name="robe verte", image_url="https://...").'
        }

        console.log(`📝 Prompt size: ${systemPrompt.length} chars`)

        // Préparer les messages
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-50) // Garder les 50 derniers messages
        ]

        // Gérer les images
        if (options.imageBase64) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: userMessage || "Que penses-tu de cette image ?" },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${options.imageBase64}` } }
                ]
            })
        } else {
            messages.push({ role: 'user', content: userMessage })
        }

        const modelToUse = options.imageBase64 ? 'gpt-4o' : (agent.model || 'gpt-4o-mini')
        const activeServiceEngine = activeEngineHint || detectServiceEngine(products || [], userMessage || '')
        const isRestaurantMode = activeServiceEngine === 'RESTAURANT'

        // Feature flags globaux — désactiver les tools si le flag est explicitement à false
        const flagBooking = options.featureFlags?.ai_tools_booking !== false
        const flagOrders = options.featureFlags?.ai_tools_orders !== false
        const FLAG_DISABLED_TOOLS = [
            ...(!flagBooking ? ['create_booking'] : []),
            ...(!flagOrders ? ['create_order', 'create_restaurant_checkout', 'check_payment_status'] : []),
        ]

        // En mode Support Client (KB-only), désactiver tous les tools transactionnels
        // send_image est conservé : l'agent support peut envoyer des images depuis la KB
        // capture_lead est conservé uniquement si lead_collection_enabled
        const SUPPORT_CLIENT_DISABLED_TOOLS = ['create_order', 'check_payment_status', 'create_booking', 'find_order', 'create_restaurant_checkout']
        const RESTAURANT_DISABLED_TOOLS = ['create_order', 'create_booking']
        // preview_cart calcule un récap chiffré fiable pour le mode collecte de leads —
        // inutile ailleurs (create_order/create_restaurant_checkout font déjà ce calcul en interne).
        const activeTools = isLeadOnlyMode
            // Mêmes outils transactionnels désactivés que le mode support client, mais
            // capture_lead reste toujours actif ici (pas conditionné à lead_collection_enabled,
            // qui a une sémantique différente : capturer un lead EN PLUS d'une commande normale).
            ? TOOLS.filter(t => !SUPPORT_CLIENT_DISABLED_TOOLS.includes(t.function?.name) && !FLAG_DISABLED_TOOLS.includes(t.function?.name))
            : isSupportClientMode
                ? TOOLS.filter(t => {
                    if (SUPPORT_CLIENT_DISABLED_TOOLS.includes(t.function?.name)) return false
                    if (FLAG_DISABLED_TOOLS.includes(t.function?.name)) return false
                    if (t.function?.name === 'preview_cart') return false
                    if (t.function?.name === 'capture_lead' && !agent.lead_collection_enabled) return false
                    return true
                })
                : isRestaurantMode
                    ? TOOLS.filter(t => !RESTAURANT_DISABLED_TOOLS.includes(t.function?.name) && !FLAG_DISABLED_TOOLS.includes(t.function?.name) && t.function?.name !== 'preview_cart')
                    : TOOLS.filter(t => t.function?.name !== 'capture_lead' && t.function?.name !== 'preview_cart' && !FLAG_DISABLED_TOOLS.includes(t.function?.name))
        const toolsConfig = activeTools.length > 0
            ? { tools: activeTools, tool_choice: 'auto' }
            : {}

        // Appel OpenAI avec retry
        const completion = await callOpenAIWithRetry(openai, {
            model: modelToUse,
            messages,
            max_tokens: agent.max_tokens || 500,
            temperature: agent.temperature || 0.7,
            ...toolsConfig
        })

        const responseMessage = completion.choices[0].message
        let content = responseMessage.content

        // ═══════════════════════════════════════════════════════════
        // GESTION DES TOOL CALLS
        // ═══════════════════════════════════════════════════════════
        let capturedLeadThisTurn = false
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            console.log('🤖 Tool calls:', responseMessage.tool_calls.length)

            const newHistory = [...messages, responseMessage]
            let directToolResponse = null

            for (const rawToolCall of responseMessage.tool_calls) {
                const toolCall = hydrateToolCallArguments(rawToolCall, checkoutState, cartState, bookingState, restaurantState, customerPhone)
                console.log(`🔧 Tool: ${toolCall.function.name}`)
                if (toolCall.function.name === 'capture_lead') capturedLeadThisTurn = true

                // Pre-check pour create_order
                const preCheck = preCheckCreateOrder(toolCall, products || [])

                if (!preCheck.valid) {
                    console.log('🚫 PRE-CHECK BLOCKED:', preCheck.error)

                    newHistory.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({
                            success: false,
                            blocked_by_precheck: true,
                            error: preCheck.error
                        })
                    })
                    continue
                }

                // Exécuter le tool
                const toolResult = await handleToolCall(
                    toolCall,
                    agent.id,
                    customerPhone,
                    products,
                    conversationId,
                    supabase,
                    { relevantDocs, userMessage }
                )

                // Collecter les actions d'images pour envoi réel
                try {
                    const parsedResult = JSON.parse(toolResult)
                    if (parsedResult.action === 'send_image' && parsedResult.image_url) {
                        if (!imageActions) imageActions = []
                        imageActions.push({
                            image_url: parsedResult.image_url,
                            caption: parsedResult.caption || '',
                            product_name: parsedResult.product_name
                        })
                        console.log(`📸 Image à envoyer: ${parsedResult.product_name}`)
                    }

                    if (
                        parsedResult.success &&
                        ['create_order', 'create_booking', 'create_restaurant_checkout', 'check_payment_status', 'find_order'].includes(toolCall.function.name)
                    ) {
                        const formattedResponse = formatDirectToolResponse(parsedResult)
                        if (formattedResponse) {
                            directToolResponse = formattedResponse
                        }
                    }
                } catch (_e) {
                    // Pas de parsing nécessaire
                }

                newHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            if (directToolResponse) {
                content = directToolResponse
            } else {
                // Second appel pour la réponse finale (avec retry)
                const secondCompletion = await callOpenAIWithRetry(openai, {
                    model: agent.model || 'gpt-4o-mini',
                    messages: newHistory,
                    max_tokens: agent.max_tokens || 500,
                    temperature: agent.temperature || 0.7
                })

                content = secondCompletion.choices[0].message.content
            }
        }

        // Post-processing : supprimer markdown images et doublons caption/texte
        content = stripMarkdownImages(content)
        content = stripImageDoublons(content, imageActions)
        content = stripLeadOnlyPaymentMentions(content, isLeadOnlyMode)
        // Avant le filet capture_lead ci-dessous : un récap de clôture non rempli ne doit
        // ni partir au client, ni compter comme une clôture qui déclenche l'enregistrement.
        content = stripLeadOnlyUnfilledRecap(content, isLeadOnlyMode)

        // Question portant sur une quantité déjà connue : on ne la corrige pas nous-mêmes,
        // on renvoie le constat au modèle et on le laisse reformuler (voir
        // findStaleQuantityQuestion). Un seul essai : au-delà, mieux vaut la réponse
        // imparfaite qu'une latence supplémentaire pour le client.
        if (isLeadOnlyMode) {
            const stale = findStaleQuantityQuestion(content, leadState)
            if (stale) {
                try {
                    // La phrase fautive est journalisée telle quelle : sans elle, impossible
                    // de comprendre a posteriori pourquoi le modèle a reposé la question.
                    // Tronquée à 160 caractères pour rester lisible dans les logs PM2.
                    console.log(`⚠️ [lead_only] Question sur une quantité déjà connue (${stale.item.product_name} = ${stale.item.quantity}) — reformulation demandée`)
                    console.log(`   ↳ phrase fautive : "${stale.sentence.slice(0, 160)}"`)
                    const correction = `${systemPrompt}\n\n🚨 CORRECTION IMMÉDIATE (prioritaire sur tout le reste) : ta réponse précédente contenait « ${stale.sentence} ». Or la quantité de "${stale.item.product_name}" est DÉJÀ connue : ${stale.item.quantity}. Cette question est impossible, elle oblige le client à répéter ce qu'il vient de dire. Réécris ta réponse en entier sans elle : traite ce qui est réellement en attente, ou enchaîne sur l'étape suivante du flux.`
                    const retry = await callOpenAIWithRetry(openai, {
                        model: modelToUse,
                        messages: [{ role: 'system', content: correction }, ...messages.slice(1)],
                        max_tokens: agent.max_tokens || 500,
                        temperature: agent.temperature || 0.7,
                        ...toolsConfig,
                    })
                    const retried = retry.choices[0]?.message
                    if (retried?.content) {
                        content = stripLeadOnlyUnfilledRecap(
                            stripLeadOnlyPaymentMentions(stripMarkdownImages(retried.content), isLeadOnlyMode),
                            isLeadOnlyMode
                        )
                        // Vérifie que la reformulation a réellement réglé le problème : c'est
                        // le seul moyen de savoir, en production, si le garde-fou tient ou si
                        // le modèle repose la même question malgré la correction.
                        const stillStale = findStaleQuantityQuestion(content, leadState)
                        console.log(stillStale
                            ? `   ↳ ❌ reformulation INSUFFISANTE, la question persiste : "${stillStale.sentence.slice(0, 160)}"`
                            : '   ↳ ✅ reformulation OK, la question a disparu')
                    } else {
                        console.log('   ↳ ⚠️ reformulation sans texte (appel d\'outil seul), réponse initiale conservée')
                    }
                } catch (retryErr) {
                    console.error('⚠️ [lead_only] Reformulation échouée, réponse initiale conservée:', retryErr?.message || retryErr)
                }
            }
        }

        // Filet de sécurité mode lead_only : le récap de clôture (bloc "*Vos coordonnées :*"
        // imposé par l'ÉTAPE 5 du workflow) ne doit JAMAIS être envoyé sans que capture_lead
        // ait réellement été appelé — observé en production : le modèle écrit parfois le
        // message de succès sans appeler l'outil, et aucun lead n'est enregistré. On force
        // l'appel ici ; capture_lead est idempotent par conversation_id (upsert), donc aucun
        // risque de doublon si l'IA l'avait en fait déjà appelé plus tôt dans l'historique.
        if (isLeadOnlyMode && !capturedLeadThisTurn && content && content.includes('*Vos coordonnées :*')) {
            try {
                console.log('⚠️ [lead_only] Récap de clôture détecté sans capture_lead — appel forcé')
                const captureTool = TOOLS.find(t => t.function?.name === 'capture_lead')
                if (captureTool) {
                    const forcedCompletion = await callOpenAIWithRetry(openai, {
                        model: agent.model || 'gpt-4o-mini',
                        messages: [...messages, { role: 'assistant', content }],
                        max_tokens: 500,
                        temperature: agent.temperature || 0.7,
                        tools: [captureTool],
                        tool_choice: { type: 'function', function: { name: 'capture_lead' } }
                    })
                    const forcedToolCall = forcedCompletion.choices[0]?.message?.tool_calls?.[0]
                    if (forcedToolCall) {
                        await handleToolCall(forcedToolCall, agent.id, customerPhone, products, conversationId, supabase, { relevantDocs, userMessage })
                        console.log('✅ [lead_only] capture_lead forcé exécuté avec succès')
                    }
                }
            } catch (forceErr) {
                console.error('⚠️ [lead_only] Échec du filet de sécurité capture_lead:', forceErr?.message || forceErr)
            }
        }

        // Vérification d'intégrité (prix)
        const integrityCheck = verifyResponseIntegrity(content, products)
        if (!integrityCheck.isValid) {
            console.log('⚠️ Integrity issues detected:', integrityCheck.issues)
            // TODO: Optionnellement régénérer si hallucination critique
        }

        return {
            content: content,
            tokensUsed: (completion.usage?.total_tokens || 0) + 100,
            imageActions: imageActions || []  // Retourner les images à envoyer
        }


    } catch (error) {
        console.error('❌ OpenAI Error:', error)

        // Logger à Sentry si disponible
        try {
            const Sentry = require('@sentry/node')
            Sentry.captureException(error, {
                tags: { component: 'generator', type: 'openai_error' },
                extra: {
                    agentId: options.agent?.id,
                    customerPhone: options.customerPhone,
                    messageLength: options.userMessage?.length
                }
            })
        } catch (_e) {
            // Sentry non configuré, ignorer
        }

        return {
            content: 'Désolé, je rencontre un problème technique momentané. Veuillez réessayer dans quelques instants.',
            tokensUsed: 0
        }
    }
}

// stripLeadOnlyUnfilledRecap est exporté uniquement pour être testable unitairement :
// son déclenchement dépend d'une sortie du modèle, impossible à provoquer autrement.
module.exports = { generateAIResponse, stripLeadOnlyUnfilledRecap, findStaleQuantityQuestion }
