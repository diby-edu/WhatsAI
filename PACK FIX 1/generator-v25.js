/**
 * ═══════════════════════════════════════════════════════════════
 * GENERATOR.JS v2.5 - AVEC LOGS DEBUG + PRE-CHECK
 * ═══════════════════════════════════════════════════════════════
 * 
 * NOUVEAUTÉS v2.5 :
 * 1. Log détaillé de ce que l'IA envoie dans create_order
 * 2. Pre-check qui bloque si selected_variants manquant
 * 3. Prompt plus court (v2.5) = meilleure rétention par GPT
 */

const { TOOLS, handleToolCall } = require('./tools')
const { findRelevantDocuments } = require('./rag')
const { verifyResponseIntegrity } = require('../utils/security')
const { buildAdaptiveSystemPrompt } = require('./prompt-builder')

/**
 * 🔍 PRE-CHECK + DEBUG LOG
 */
function preCheckCreateOrder(toolCall, products) {
    if (toolCall.function.name !== 'create_order') {
        return { valid: true }
    }

    try {
        const args = JSON.parse(toolCall.function.arguments)
        
        // 📊 LOG DEBUG : Voir exactement ce que l'IA envoie
        console.log('═══════════════════════════════════════════════')
        console.log('🔍 DEBUG create_order - Arguments reçus de l\'IA :')
        console.log(JSON.stringify(args, null, 2))
        console.log('═══════════════════════════════════════════════')

        if (!args.items || !Array.isArray(args.items)) {
            console.log('❌ PRE-CHECK: items manquants ou invalides')
            return { valid: false, error: 'Items manquants' }
        }

        for (const item of args.items) {
            console.log(`📦 Item: "${item.product_name}" x${item.quantity}`)
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
                console.log(`   ⚠️ Produit non trouvé dans le catalogue`)
                continue
            }

            console.log(`   ✅ Produit trouvé: "${product.name}"`)
            console.log(`   Variantes du produit:`, product.variants?.map(v => v.name) || 'Aucune')

            if (product.variants && product.variants.length > 0) {
                const selectedVariants = item.selected_variants || {}
                
                for (const variant of product.variants) {
                    const variantName = variant.name
                    const variantNameLower = variantName.toLowerCase()
                    
                    const hasVariant = Object.keys(selectedVariants).some(
                        k => k.toLowerCase() === variantNameLower
                    )
                    
                    if (!hasVariant) {
                        const options = variant.options.map(o => 
                            typeof o === 'string' ? o : (o.value || o.name)
                        ).join(', ')
                        
                        console.log(`   ❌ VARIANTE MANQUANTE: "${variantName}"`)
                        console.log(`   Options disponibles: ${options}`)
                        
                        return {
                            valid: false,
                            error: `Variante "${variantName}" manquante dans selected_variants. ` +
                                   `Demande au client de choisir parmi: ${options}. ` +
                                   `Puis rappelle create_order avec selected_variants: {"${variantName}": "choix_du_client"}`
                        }
                    } else {
                        const selectedValue = Object.entries(selectedVariants).find(
                            ([k]) => k.toLowerCase() === variantNameLower
                        )?.[1]
                        console.log(`   ✅ ${variantName}: "${selectedValue}"`)
                    }
                }
            }
        }

        console.log('✅ PRE-CHECK PASSED: Toutes les variantes sont présentes')
        return { valid: true }
        
    } catch (e) {
        console.error('❌ PRE-CHECK ERROR:', e.message)
        return { valid: true } // En cas d'erreur, laisser passer
    }
}

/**
 * Generate AI Response v2.5
 */
async function generateAIResponse(options, dependencies) {
    const { openai, supabase, activeSessions, CinetPay } = dependencies
    
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

        // RAG
        const relevantDocs = await findRelevantDocuments(openai, supabase, agent.id, userMessage)

        // Business Hours
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
            } catch (e) {
                formattedHours = String(agent.business_hours)
            }
        }

        const gpsLink = (agent.latitude && agent.longitude)
            ? `https://www.google.com/maps?q=${agent.latitude},${agent.longitude}`
            : ''

        // Build System Prompt (v2.5 - plus court, variantes en premier)
        const systemPrompt = buildAdaptiveSystemPrompt(
            agent,
            products || [],
            orders || [],
            relevantDocs || [],
            currency,
            gpsLink,
            formattedHours
        )

        // Log la taille du prompt (debug)
        console.log(`📝 Prompt size: ${systemPrompt.length} chars`)

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-15)
        ]

        // Image handling
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

        const completion = await openai.chat.completions.create({
            model: modelToUse,
            messages,
            max_tokens: agent.max_tokens || 500,
            temperature: agent.temperature || 0.7,
            tools: TOOLS,
            tool_choice: 'auto'
        })

        const responseMessage = completion.choices[0].message
        let content = responseMessage.content

        // ═══════════════════════════════════════════════════════════════
        // TOOL CALLS avec PRE-CHECK
        // ═══════════════════════════════════════════════════════════════
        if (responseMessage.tool_calls) {
            console.log('🤖 Model wants to call tools:', responseMessage.tool_calls.length)

            const newHistory = [...messages, responseMessage]

            for (const toolCall of responseMessage.tool_calls) {
                console.log(`🔧 Tool: ${toolCall.function.name}`)
                
                // PRE-CHECK pour create_order
                const preCheck = preCheckCreateOrder(toolCall, products || [])
                
                if (!preCheck.valid) {
                    console.log('🚫 PRE-CHECK BLOCKED:', preCheck.error)
                    
                    newHistory.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({
                            success: false,
                            blocked: true,
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

                newHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult
                })
            }

            // Second call
            const secondCompletion = await openai.chat.completions.create({
                model: agent.model || 'gpt-4o-mini',
                messages: newHistory,
                max_tokens: agent.max_tokens || 500,
                temperature: agent.temperature || 0.7
            })

            content = secondCompletion.choices[0].message.content
        }

        // Integrity check
        const integrityCheck = verifyResponseIntegrity(content, products)
        if (!integrityCheck.isValid) {
            console.log('⚠️ Response integrity issues:', integrityCheck.issues)
        }

        return {
            content: content,
            tokensUsed: (completion.usage?.total_tokens || 0) + 100
        }
        
    } catch (error) {
        console.error('OpenAI error:', error)
        return { 
            content: 'Désolé, je rencontre un problème technique. Veuillez réessayer.', 
            tokensUsed: 0 
        }
    }
}

module.exports = { generateAIResponse }
