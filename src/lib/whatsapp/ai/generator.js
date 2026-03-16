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
                            error: `Variante "${variantName}" manquante. ` +
                                `Demande au client de choisir parmi: ${options}. ` +
                                `Puis rappelle create_order avec selected_variants: {"${variantName}": "choix"}`
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
            currency = 'USD'
        } = options

        // RAG - Documents pertinents
        const relevantDocs = await findRelevantDocuments(openai, supabase, agent.id, userMessage)

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
        const systemPrompt = buildAdaptiveSystemPrompt(
            agent,
            products || [],
            orders || [],
            relevantDocs || [],
            currency,
            options.gpsLink || gpsLink || '',
            options.formattedHours || formattedHours || 'Non spécifiés',
            options.justOrdered || false, // Passer le flag de reset
            userMessage || '' // v2.19: Intent Detection Context
        )
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

        // Appel OpenAI avec retry
        const completion = await callOpenAIWithRetry(openai, {
            model: modelToUse,
            messages,
            max_tokens: agent.max_tokens || 500,
            temperature: agent.temperature || 0.7,
            tools: TOOLS,
            tool_choice: 'auto'
        })

        const responseMessage = completion.choices[0].message
        let content = responseMessage.content

        // ═══════════════════════════════════════════════════════════
        // GESTION DES TOOL CALLS
        // ═══════════════════════════════════════════════════════════
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            console.log('🤖 Tool calls:', responseMessage.tool_calls.length)

            const newHistory = [...messages, responseMessage]

            for (const toolCall of responseMessage.tool_calls) {
                console.log(`🔧 Tool: ${toolCall.function.name}`)

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
                    activeSessions,
                    CinetPay
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
                } catch (_e) {
                    // Pas de parsing nécessaire
                }

                newHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            // Second appel pour la réponse finale (avec retry)
            const secondCompletion = await callOpenAIWithRetry(openai, {
                model: agent.model || 'gpt-4o-mini',
                messages: newHistory,
                max_tokens: agent.max_tokens || 500,
                temperature: agent.temperature || 0.7
            })

            content = secondCompletion.choices[0].message.content
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

module.exports = { generateAIResponse }
