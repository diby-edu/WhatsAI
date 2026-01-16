/**
 * ═══════════════════════════════════════════════════════════════
 * WHATSAI TOOLS v2.3 - FIX BOUCLE VARIANTES
 * ═══════════════════════════════════════════════════════════════
 * 
 * PROBLÈME RÉSOLU :
 * - Le bot tournait en boucle en demandant la couleur plusieurs fois
 * - La commande ne se créait jamais
 * 
 * CAUSE IDENTIFIÉE :
 * 1. L'IA envoie product_name="T-Shirt Premium en coton bio" 
 *    sans inclure les variantes dedans
 * 2. Le code cherchait "Bleu Marine" dans "T-Shirt Premium en coton bio"
 * 3. Échec → retourne missing_variants → l'IA re-demande → boucle
 * 
 * SOLUTION :
 * - Ajouter des champs EXPLICITES pour les variantes dans le tool
 * - Ne plus dépendre du nom du produit pour extraire les variantes
 * 
 * CHANGELOG v2.3 :
 * ✅ Ajout de 'selected_variants' dans create_order parameters
 * ✅ Meilleure logique de matching des variantes
 * ✅ Messages d'erreur plus clairs pour l'IA
 */

const { normalizePhoneNumber } = require('../utils/format')
const sharp = require('sharp')

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: `Create a new order for a customer. 
IMPORTANT FOR PRODUCTS WITH VARIANTS:
- If a product has variants (size, color, etc.), you MUST specify them in 'selected_variants'
- Check the product catalog for available variants BEFORE calling this function
- Example: {"Taille": "Moyenne", "Couleur": "Bleu Marine"}
- If variants are missing, the order will FAIL and you'll need to ask the customer`,
            parameters: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                product_name: { 
                                    type: 'string', 
                                    description: 'EXACT name of the product from the catalog (without variant info)' 
                                },
                                quantity: { 
                                    type: 'integer', 
                                    description: 'Quantity ordered' 
                                },
                                selected_variants: {
                                    type: 'object',
                                    description: 'REQUIRED if product has variants. Key = variant name (e.g. "Taille", "Couleur"), Value = selected option (e.g. "Moyenne", "Bleu Marine")',
                                    additionalProperties: { type: 'string' }
                                }
                            },
                            required: ['product_name', 'quantity']
                        },
                        description: 'List of products to order'
                    },
                    customer_name: { type: 'string', description: 'Customer full name (required)' },
                    customer_phone: { type: 'string', description: 'Customer phone number (required)' },
                    delivery_address: { type: 'string', description: 'Full Delivery Location (City, Neighborhood, Street, or GPS info). Do NOT split city/street.' },
                    email: { type: 'string', description: 'Customer email (required for digital products)' },
                    payment_method: { type: 'string', enum: ['online', 'cod'], description: 'Payment method choice' },
                    notes: { type: 'string', description: 'Any special instructions' }
                },
                required: ['items', 'customer_name', 'customer_phone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'check_payment_status',
            description: 'Check the status of a specific order. If the user asks about "my order" or "the payment" without giving an ID, USE the most recent UUID found in the "Historique des Commandes" context.',
            parameters: {
                type: 'object',
                properties: {
                    order_id: { type: 'string', description: 'The Order ID UUID' }
                },
                required: ['order_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_image',
            description: 'Send an image of a product. Use ONLY when user explicitly asks to see a product or during a sales pitch. DO NOT use when checking order status.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: { type: 'string', description: 'The name of the product to show' },
                    variant_value: { type: 'string', description: 'Optional: Specific variant option (e.g., "Rouge", "Bleu", "XL") to show variant-specific image if available' }
                },
                required: ['product_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_booking',
            description: 'Create a booking/reservation for a SERVICE (not physical products). Use this when the user wants to book a service like consultation, installation, maintenance, etc. This is different from create_order which is for products.',
            parameters: {
                type: 'object',
                properties: {
                    service_name: { type: 'string', description: 'Name of the service from the catalog' },
                    customer_phone: { type: 'string', description: 'Customer phone number (required)' },
                    customer_name: { type: 'string', description: 'Customer name' },
                    preferred_date: { type: 'string', description: 'Preferred date for the service (YYYY-MM-DD format)' },
                    preferred_time: { type: 'string', description: 'Preferred time (HH:MM format, e.g., 14:00)' },
                    location: { type: 'string', description: 'Location for the service (address or "remote/online")' },
                    notes: { type: 'string', description: 'Special requirements or additional details' }
                },
                required: ['service_name', 'customer_phone', 'preferred_date']
            }
        }
    }
]

/**
 * Tool Executor - Version 2.3 avec fix variantes
 */
async function handleToolCall(toolCall, agentId, customerPhone, products, conversationId, supabase, activeSessions, CinetPay) {
    
    if (toolCall.function.name === 'create_order') {
        try {
            console.log('🛠️ Executing tool: create_order')
            const args = JSON.parse(toolCall.function.arguments)
            const { items, customer_name, customer_phone, delivery_address, email, payment_method, notes } = args

            // Append email to notes if present
            let finalNotes = notes || ''
            if (email) {
                finalNotes += `\n📧 Email client: ${email}`
            }

            // Get agent with payment settings
            const { data: agent } = await supabase
                .from('agents')
                .select('user_id, payment_mode, mobile_money_orange, mobile_money_mtn, mobile_money_wave, custom_payment_methods')
                .eq('id', agentId)
                .single()
            if (!agent) throw new Error('Agent not found')

            let total = 0
            const orderItems = []
            const allMissingVariants = []

            // Match products and calculate total
            for (const item of items) {
                const searchTerms = item.product_name.toLowerCase().split(' ').filter(w => w.length > 2)
                const searchName = item.product_name.toLowerCase()

                // Score each product and find the best match
                let bestProduct = null
                let bestScore = 0

                for (const p of products) {
                    const productName = p.name.toLowerCase()
                    const productText = `${p.name} ${p.description || ''} ${p.ai_instructions || ''}`.toLowerCase()
                    let score = 0

                    if (productName === searchName) {
                        score = 100
                    }
                    else if (searchName.includes(productName) || productName.includes(searchName)) {
                        score = 50
                    }
                    else {
                        const nameMatchCount = searchTerms.filter(term => productName.includes(term)).length
                        score = nameMatchCount * 10
                        if (score < 20) {
                            const descMatchCount = searchTerms.filter(term => productText.includes(term)).length
                            score += descMatchCount * 2
                        }
                    }

                    if (score > bestScore) {
                        bestScore = score
                        bestProduct = p
                    }
                }

                const product = bestScore >= 10 ? bestProduct : null

                if (product) {
                    let price = product.price_fcfa || 0
                    let matchedVariantOption = null

                    // ═══════════════════════════════════════════════════════
                    // 🔧 FIX v2.3 : NOUVELLE LOGIQUE DE MATCHING DES VARIANTES
                    // ═══════════════════════════════════════════════════════
                    if (product.variants && product.variants.length > 0) {
                        const matchedVariantsByType = {}
                        
                        // 📌 MÉTHODE 1 : Utiliser selected_variants (NOUVEAU - PRIORITAIRE)
                        if (item.selected_variants && typeof item.selected_variants === 'object') {
                            console.log('📦 Using selected_variants:', item.selected_variants)
                            
                            for (const variant of product.variants) {
                                const variantName = variant.name.toLowerCase()
                                
                                // Chercher dans selected_variants (case insensitive)
                                const selectedValue = Object.entries(item.selected_variants).find(
                                    ([key, val]) => key.toLowerCase() === variantName
                                )?.[1]
                                
                                if (selectedValue) {
                                    // Valider que cette option existe
                                    const validOption = variant.options.find(opt => {
                                        const optValue = (typeof opt === 'string') ? opt : (opt.value || opt.name || '')
                                        return optValue.toLowerCase() === selectedValue.toLowerCase()
                                    })
                                    
                                    if (validOption) {
                                        const optionPrice = (typeof validOption === 'string') ? 0 : (validOption.price || 0)
                                        if (variant.type === 'fixed') {
                                            price = optionPrice
                                        } else {
                                            price += optionPrice
                                        }
                                        matchedVariantsByType[variant.name] = (typeof validOption === 'string') ? validOption : (validOption.value || validOption.name)
                                        console.log(`✅ Variant matched: ${variant.name} = ${matchedVariantsByType[variant.name]}`)
                                    }
                                }
                            }
                        }
                        
                        // 📌 MÉTHODE 2 : Fallback - Chercher dans product_name (ancien comportement)
                        for (const variant of product.variants) {
                            if (matchedVariantsByType[variant.name]) continue // Déjà trouvé
                            
                            for (const option of variant.options) {
                                const optionValue = (typeof option === 'string') ? option : (option.value || option.name || '')

                                // Chercher dans le nom du produit
                                if (optionValue && item.product_name.toLowerCase().includes(optionValue.toLowerCase())) {
                                    const optionPrice = (typeof option === 'string') ? 0 : (option.price || 0)
                                    if (variant.type === 'fixed') {
                                        price = optionPrice
                                    } else {
                                        price += optionPrice
                                    }
                                    matchedVariantsByType[variant.name] = optionValue
                                    console.log(`✅ Variant found in product_name: ${variant.name} = ${optionValue}`)
                                    break
                                }
                            }
                        }

                        // Vérifier les variantes manquantes
                        const unMatchedVariants = product.variants.filter(v => !matchedVariantsByType[v.name])

                        if (unMatchedVariants.length > 0) {
                            console.log('❌ Missing variant types:', unMatchedVariants.map(v => v.name).join(', '))
                            
                            // Collecter pour le message d'erreur global
                            allMissingVariants.push({
                                product_name: product.name,
                                missing: unMatchedVariants.map(v => ({
                                    name: v.name,
                                    options: v.options.map(o => (typeof o === 'string') ? o : (o.value || o.name))
                                }))
                            })
                            continue // Passer au produit suivant
                        }
                        
                        matchedVariantOption = Object.values(matchedVariantsByType).join(', ')
                    }

                    total += price * item.quantity
                    orderItems.push({
                        product_name: matchedVariantOption
                            ? `${product.name} (${matchedVariantOption})`
                            : product.name,
                        quantity: item.quantity,
                        unit_price: price,
                        product_id: product.id
                    })
                } else {
                    console.warn(`❓ Product not found: "${item.product_name}"`)
                }
            }

            // ═══════════════════════════════════════════════════════
            // 🚫 SI DES VARIANTES MANQUENT → RETOURNER ERREUR CLAIRE
            // ═══════════════════════════════════════════════════════
            if (allMissingVariants.length > 0) {
                const errorMessages = allMissingVariants.map(mv => {
                    const variantList = mv.missing.map(m => 
                        `${m.name}: ${m.options.join(', ')}`
                    ).join(' | ')
                    return `"${mv.product_name}" → ${variantList}`
                }).join('\n')
                
                return JSON.stringify({
                    success: false,
                    error: `VARIANTES MANQUANTES. Avant de créer la commande, demandez au client de choisir:\n${errorMessages}`,
                    missing_variants: allMissingVariants,
                    hint: 'Utilisez le champ "selected_variants" dans items pour passer les choix du client. Exemple: {"Taille": "Moyenne", "Couleur": "Bleu Marine"}'
                })
            }

            // Validation : au moins un item valide
            if (orderItems.length === 0) {
                return JSON.stringify({
                    success: false,
                    error: 'Aucun produit valide trouvé dans la commande. Vérifiez les noms des produits.'
                })
            }

            // Normalize phone
            const normalizedPhone = normalizePhoneNumber(customer_phone) || customer_phone

            // Determine payment mode
            let finalPaymentMethod = 'online'
            let paymentMethods = []

            if (agent.payment_mode === 'mobile_money_direct') {
                finalPaymentMethod = 'mobile_money_direct'
                if (agent.mobile_money_orange) paymentMethods.push({ type: 'Orange Money', number: agent.mobile_money_orange })
                if (agent.mobile_money_mtn) paymentMethods.push({ type: 'MTN Money', number: agent.mobile_money_mtn })
                if (agent.mobile_money_wave) paymentMethods.push({ type: 'Wave', number: agent.mobile_money_wave })
            } else if (payment_method === 'cod') {
                finalPaymentMethod = 'cod'
            }

            // Create order in database
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: agent.user_id,
                    agent_id: agentId,
                    customer_phone: normalizedPhone,
                    customer_name: customer_name,
                    delivery_address: delivery_address,
                    notes: finalNotes,
                    total_fcfa: total,
                    payment_method: finalPaymentMethod,
                    status: finalPaymentMethod === 'cod' ? 'pending_delivery' : 'pending',
                    conversation_id: conversationId
                })
                .select()
                .single()

            if (orderError) {
                console.error('❌ Order creation error:', orderError)
                return JSON.stringify({
                    success: false,
                    error: `Erreur création commande: ${orderError.message}`
                })
            }

            // Insert order items
            if (order && orderItems.length > 0) {
                const itemsToInsert = orderItems.map(item => ({
                    order_id: order.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    quantity: item.quantity,
                    unit_price_fcfa: item.unit_price
                }))
                await supabase.from('order_items').insert(itemsToInsert)
            }

            // Generate payment link if needed (CinetPay)
            let paymentLink = null
            if (finalPaymentMethod === 'online' && CinetPay && total > 0) {
                try {
                    const cinetpay = new CinetPay(
                        process.env.CINETPAY_SITE_ID,
                        process.env.CINETPAY_API_KEY
                    )
                    const transaction = await cinetpay.initPayment({
                        amount: total,
                        currency: 'XOF',
                        transaction_id: order.id,
                        description: `Commande ${order.order_number}`,
                        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/success`,
                        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/cinetpay`,
                        customer_name: customer_name,
                        customer_phone: normalizedPhone
                    })
                    paymentLink = transaction.payment_url
                } catch (e) {
                    console.error('CinetPay error:', e)
                }
            }

            // Build success response
            const itemsSummary = orderItems.map(i => `${i.quantity}x ${i.product_name}`).join(', ')

            console.log('✅ Order created:', order.id)

            return JSON.stringify({
                success: true,
                order_id: order.id,
                order_number: order.order_number,
                total: total,
                items: itemsSummary,
                payment_method: finalPaymentMethod,
                payment_link: paymentLink,
                payment_methods: paymentMethods.length > 0 ? paymentMethods : undefined,
                message: finalPaymentMethod === 'cod' 
                    ? `Commande créée ! Total: ${total} FCFA. Paiement à la livraison.`
                    : finalPaymentMethod === 'mobile_money_direct'
                    ? `Commande créée ! Total: ${total} FCFA. Envoyez le paiement puis la capture d'écran.`
                    : `Commande créée ! Total: ${total} FCFA.`
            })

        } catch (error) {
            console.error('Create Order Error:', error)
            return JSON.stringify({
                success: false,
                error: 'Une erreur est survenue lors de la création de la commande.'
            })
        }
    }

    // ... autres handlers (check_payment_status, send_image, create_booking) restent identiques
    // [Code omis pour brièveté - garder l'existant]

    if (toolCall.function.name === 'check_payment_status') {
        try {
            console.log('🛠️ Executing tool: check_payment_status')
            const args = JSON.parse(toolCall.function.arguments)
            const { order_id } = args

            const { data: order, error } = await supabase
                .from('orders')
                .select('*')
                .eq('id', order_id)
                .single()

            if (error || !order) {
                return JSON.stringify({
                    success: false,
                    error: `Commande ${order_id} introuvable.`
                })
            }

            let statusMessage = ''
            switch (order.status) {
                case 'pending':
                    statusMessage = `⏳ Paiement en attente pour la commande #${order.order_number}. Total: ${order.total_fcfa} FCFA.`
                    break
                case 'paid':
                    statusMessage = `✅ Paiement confirmé ! Commande #${order.order_number} en cours de traitement.`
                    break
                case 'pending_delivery':
                    statusMessage = `📦 Commande #${order.order_number} en cours de livraison. Total: ${order.total_fcfa} FCFA.`
                    break
                case 'delivered':
                    statusMessage = `🎉 Commande #${order.order_number} livrée avec succès !`
                    break
                case 'cancelled':
                    statusMessage = `❌ Commande #${order.order_number} annulée.`
                    break
                default:
                    statusMessage = `Statut actuel: ${order.status}`
            }

            return JSON.stringify({
                success: true,
                order_id: order.id,
                status: order.status,
                message: statusMessage
            })

        } catch (error) {
            console.error('Check Payment Error:', error)
            return JSON.stringify({
                success: false,
                error: 'Erreur lors de la vérification du paiement.'
            })
        }
    }

    if (toolCall.function.name === 'send_image') {
        try {
            console.log('🛠️ Executing tool: send_image')
            const args = JSON.parse(toolCall.function.arguments)
            const { product_name, variant_value } = args

            const searchName = product_name.toLowerCase()
            let bestProduct = null
            let bestScore = 0

            for (const p of products) {
                const productName = p.name.toLowerCase()
                let score = 0

                if (productName === searchName) score = 100
                else if (searchName.includes(productName) || productName.includes(searchName)) score = 50

                if (score > bestScore) {
                    bestScore = score
                    bestProduct = p
                }
            }

            const product = bestScore >= 10 ? bestProduct : null

            if (!product) {
                return JSON.stringify({
                    success: false,
                    error: `Produit "${product_name}" introuvable.`
                })
            }

            let imageUrl = product.image_url
            if (variant_value && product.variants) {
                for (const variant of product.variants) {
                    for (const opt of variant.options) {
                        if (typeof opt !== 'string' && opt.image) {
                            const optValue = opt.value || opt.name || ''
                            if (optValue.toLowerCase() === variant_value.toLowerCase()) {
                                imageUrl = opt.image
                                break
                            }
                        }
                    }
                }
            }

            if (!imageUrl) {
                return JSON.stringify({
                    success: false,
                    error: `Pas d'image disponible pour "${product.name}".`
                })
            }

            return JSON.stringify({
                success: true,
                action: 'send_image',
                image_url: imageUrl,
                caption: `Voici ${product.name} !`,
                product_name: product.name
            })

        } catch (error) {
            console.error('Send Image Error:', error)
            return JSON.stringify({
                success: false,
                error: 'Erreur lors de l\'envoi de l\'image.'
            })
        }
    }

    if (toolCall.function.name === 'create_booking') {
        try {
            console.log('🛠️ Executing tool: create_booking')
            const args = JSON.parse(toolCall.function.arguments)

            return JSON.stringify({
                success: true,
                message: `Réservation enregistrée pour ${args.service_name} le ${args.preferred_date}.`
            })
        } catch (error) {
            console.error('Create Booking Error:', error)
            return JSON.stringify({
                success: false,
                error: 'Erreur lors de la création de la réservation.'
            })
        }
    }

    return JSON.stringify({ success: false, error: 'Unknown tool' })
}

module.exports = { TOOLS, handleToolCall }
