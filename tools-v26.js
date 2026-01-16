/**
 * ═══════════════════════════════════════════════════════════════
 * TOOLS.JS v2.6 - FIX MATCHING FLEXIBLE DES VARIANTES
 * ═══════════════════════════════════════════════════════════════
 * 
 * BUG IDENTIFIÉ :
 * - L'IA envoie: selected_variants: { Taille: "Petite" }
 * - La BDD contient: options: ["Petite (50g)", "Moyenne (100g)", "Grande (200g)"]
 * - Le code cherchait une égalité stricte "Petite" === "Petite (50g)" → FALSE
 * 
 * FIX v2.6 :
 * - Matching flexible : l'option CONTIENT ou COMMENCE PAR la valeur envoyée
 * - "Petite" matche "Petite (50g)" ✅
 * - "Or Premium" matche "Or Premium" ✅
 * - Logs améliorés pour debug
 */

const { normalizePhoneNumber } = require('../utils/format')
const sharp = require('sharp')

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: `Create a new order for a customer. Use this when the user wants to buy something.
IMPORTANT FOR PRODUCTS WITH VARIANTS:
- If a product has variants (size, color, etc.), you MUST specify them in 'selected_variants'
- Collect ALL variants from the customer BEFORE calling this function
- Example: selected_variants: {"Taille": "Moyenne", "Couleur": "Bleu Marine"}
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
 * 🔧 HELPER : Matching flexible des options de variantes
 * "Petite" doit matcher "Petite (50g)"
 * "Or Premium" doit matcher "Or Premium"
 */
function findMatchingOption(variant, selectedValue) {
    const selectedLower = selectedValue.toLowerCase().trim()
    
    for (const option of variant.options) {
        const optValue = (typeof option === 'string') ? option : (option.value || option.name || '')
        const optValueLower = optValue.toLowerCase().trim()
        
        // Matching flexible :
        // 1. Égalité exacte
        // 2. L'option commence par la valeur sélectionnée
        // 3. La valeur sélectionnée commence par l'option (cas inverse)
        // 4. L'option contient la valeur sélectionnée
        if (
            optValueLower === selectedLower ||
            optValueLower.startsWith(selectedLower) ||
            selectedLower.startsWith(optValueLower) ||
            optValueLower.includes(selectedLower)
        ) {
            console.log(`      🎯 Match trouvé: "${selectedValue}" → "${optValue}"`)
            return option
        }
    }
    
    console.log(`      ❌ Pas de match pour "${selectedValue}" dans [${variant.options.map(o => typeof o === 'string' ? o : o.value).join(', ')}]`)
    return null
}

/**
 * Tool Executor v2.6
 */
async function handleToolCall(toolCall, agentId, customerPhone, products, conversationId, supabase, activeSessions, CinetPay) {
    
    if (toolCall.function.name === 'create_order') {
        try {
            console.log('🛠️ Executing tool: create_order')
            const args = JSON.parse(toolCall.function.arguments)
            const { items, customer_name, customer_phone, delivery_address, email, payment_method, notes } = args

            let finalNotes = notes || ''
            if (email) {
                finalNotes += `\n📧 Email client: ${email}`
            }

            const { data: agent } = await supabase
                .from('agents')
                .select('user_id, payment_mode, mobile_money_orange, mobile_money_mtn, mobile_money_wave, custom_payment_methods')
                .eq('id', agentId)
                .single()
            if (!agent) throw new Error('Agent not found')

            let total = 0
            const orderItems = []

            for (const item of items) {
                const searchTerms = item.product_name.toLowerCase().split(' ').filter(w => w.length > 2)
                const searchName = item.product_name.toLowerCase()

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
                    // 🔧 FIX v2.6 : MATCHING FLEXIBLE DES VARIANTES
                    // ═══════════════════════════════════════════════════════
                    if (product.variants && product.variants.length > 0) {
                        const matchedVariantsByType = {}

                        console.log(`   📋 Produit "${product.name}" a ${product.variants.length} variante(s)`)

                        // 📌 MÉTHODE 1 : Utiliser selected_variants (PRIORITAIRE)
                        if (item.selected_variants && typeof item.selected_variants === 'object') {
                            console.log('   📦 Using selected_variants:', item.selected_variants)

                            for (const variant of product.variants) {
                                const variantNameLower = variant.name.toLowerCase()
                                console.log(`      Cherche variante "${variant.name}"...`)

                                // Chercher dans selected_variants (case insensitive)
                                const selectedEntry = Object.entries(item.selected_variants).find(
                                    ([key]) => key.toLowerCase() === variantNameLower
                                )
                                
                                const selectedValue = selectedEntry ? selectedEntry[1] : null

                                if (selectedValue) {
                                    console.log(`      Valeur envoyée: "${selectedValue}"`)
                                    
                                    // 🔧 FIX v2.6 : Matching flexible
                                    const validOption = findMatchingOption(variant, selectedValue)

                                    if (validOption) {
                                        const optionPrice = (typeof validOption === 'string') ? 0 : (validOption.price || 0)
                                        if (variant.type === 'fixed') {
                                            price = optionPrice
                                        } else {
                                            price += optionPrice
                                        }
                                        const optionValue = (typeof validOption === 'string') ? validOption : (validOption.value || validOption.name)
                                        matchedVariantsByType[variant.name] = optionValue
                                        console.log(`      ✅ Variant matched: ${variant.name} = "${optionValue}" (prix: ${optionPrice})`)
                                    } else {
                                        console.log(`      ❌ Option "${selectedValue}" invalide pour ${variant.name}`)
                                    }
                                } else {
                                    console.log(`      ⚠️ Variante "${variant.name}" non trouvée dans selected_variants`)
                                }
                            }
                        }

                        // 📌 MÉTHODE 2 : Fallback - Chercher dans product_name
                        for (const variant of product.variants) {
                            if (matchedVariantsByType[variant.name]) continue

                            for (const option of variant.options) {
                                const optionValue = (typeof option === 'string') ? option : (option.value || option.name || '')

                                if (optionValue && item.product_name.toLowerCase().includes(optionValue.toLowerCase())) {
                                    const optionPrice = (typeof option === 'string') ? 0 : (option.price || 0)
                                    if (variant.type === 'fixed') {
                                        price = optionPrice
                                    } else {
                                        price += optionPrice
                                    }
                                    matchedVariantsByType[variant.name] = optionValue
                                    console.log(`      ✅ Variant found in product_name: ${variant.name} = "${optionValue}"`)
                                    break
                                }
                            }
                        }

                        // Vérifier les variantes manquantes
                        const unMatchedVariants = product.variants.filter(v => !matchedVariantsByType[v.name])

                        if (unMatchedVariants.length > 0) {
                            console.log('   ❌ Missing variant types:', unMatchedVariants.map(v => v.name).join(', '))
                            const missingOptions = unMatchedVariants.map(v =>
                                `${v.name}: ${v.options.map(o => typeof o === 'string' ? o : (o.value || o.name)).join(', ')}`
                            ).join(' | ')

                            return JSON.stringify({
                                success: false,
                                error: `VARIANTES MANQUANTES pour "${product.name}". Demandez au client: ${missingOptions}`,
                                product_name: product.name,
                                missing_variants: unMatchedVariants.map(v => ({
                                    name: v.name,
                                    options: v.options.map(o => typeof o === 'string' ? o : (o.value || o.name))
                                })),
                                hint: 'Utilisez "selected_variants" dans items. Exemple: {"Taille": "Moyenne", "Couleur": "Bleu Marine"}'
                            })
                        }
                        
                        matchedVariantOption = Object.values(matchedVariantsByType).join(', ')
                        console.log(`   ✅ Toutes les variantes matchées: ${matchedVariantOption}`)
                    }

                    total += price * item.quantity
                    orderItems.push({
                        product_name: matchedVariantOption
                            ? `${product.name} (${matchedVariantOption})`
                            : product.name,
                        product_description: product.description,
                        quantity: item.quantity,
                        unit_price_fcfa: price
                    })
                    
                    console.log(`   💰 Item ajouté: ${item.quantity}x "${orderItems[orderItems.length-1].product_name}" @ ${price} FCFA`)
                    
                } else {
                    console.log('❌ Product not found in catalog:', item.product_name)
                    const availableProducts = products.map(p => p.name).join(', ')
                    return JSON.stringify({
                        success: false,
                        error: `Je ne trouve pas "${item.product_name}" dans notre catalogue. Voici nos produits disponibles : ${availableProducts}`,
                        available_products: products.map(p => p.name)
                    })
                }
            }

            const normalizedPhone = normalizePhoneNumber(customer_phone || customerPhone)

            console.log(`📝 Création commande: ${orderItems.length} items, Total: ${total} FCFA`)

            const { data: order, error } = await supabase
                .from('orders')
                .insert({
                    user_id: agent.user_id,
                    agent_id: agentId,
                    customer_name: customer_name || 'Non spécifié',
                    customer_phone: normalizedPhone,
                    status: payment_method === 'cod' ? 'pending_delivery' : 'pending',
                    total_fcfa: total,
                    delivery_address: delivery_address || 'Non spécifié',
                    payment_method: payment_method || 'online',
                    notes: finalNotes,
                    conversation_id: conversationId
                })
                .select()
                .single()

            if (error) throw error

            if (orderItems.length > 0) {
                await supabase.from('order_items').insert(
                    orderItems.map(i => ({ ...i, order_id: order.id }))
                )
            }

            console.log(`✅ Order created: ${order.id}`)

            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://whatsai.duckdns.org'

            if (payment_method === 'cod') {
                return JSON.stringify({
                    success: true,
                    order_id: order.id,
                    payment_method: 'cod',
                    message: `Commande #${order.id.substring(0, 8)} créée. Total: ${total} FCFA. Paiement à la livraison.`
                })
            }

            if (agent.payment_mode === 'mobile_money_direct') {
                const paymentMethods = []
                if (agent.mobile_money_orange) paymentMethods.push({ type: 'Orange Money', number: agent.mobile_money_orange })
                if (agent.mobile_money_mtn) paymentMethods.push({ type: 'MTN Money', number: agent.mobile_money_mtn })
                if (agent.mobile_money_wave) paymentMethods.push({ type: 'Wave', number: agent.mobile_money_wave })

                return JSON.stringify({
                    success: true,
                    order_id: order.id,
                    total: total,
                    payment_method: 'mobile_money_direct',
                    payment_methods: paymentMethods,
                    message: `Commande #${order.id.substring(0, 8)} créée. Total: ${total} FCFA. Envoyez le paiement puis la capture d'écran.`
                })
            }

            // CinetPay
            let paymentLink = `${appUrl}/pay/${order.id}`

            return JSON.stringify({
                success: true,
                order_id: order.id,
                total: total,
                payment_method: 'online',
                payment_link: paymentLink,
                message: `Commande #${order.id.substring(0, 8)} créée. Total: ${total} FCFA.`
            })

        } catch (error) {
            console.error('Create Order Error:', error)
            return JSON.stringify({
                success: false,
                error: error.message || 'Erreur lors de la création de la commande'
            })
        }
    }

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
                    statusMessage = `⏳ Paiement en attente pour la commande #${order.id.substring(0, 8)}. Total: ${order.total_fcfa} FCFA.`
                    break
                case 'paid':
                    statusMessage = `✅ Paiement confirmé ! Commande #${order.id.substring(0, 8)} en cours de traitement.`
                    break
                case 'pending_delivery':
                    statusMessage = `📦 Commande #${order.id.substring(0, 8)} en cours de livraison.`
                    break
                case 'delivered':
                    statusMessage = `🎉 Commande #${order.id.substring(0, 8)} livrée avec succès !`
                    break
                case 'cancelled':
                    statusMessage = `❌ Commande #${order.id.substring(0, 8)} annulée.`
                    break
                default:
                    statusMessage = `Statut: ${order.status}`
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
                            if (optValue.toLowerCase().includes(variant_value.toLowerCase())) {
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
            const { service_name, customer_phone, customer_name, preferred_date, preferred_time, location, notes } = args

            const { data: agent } = await supabase
                .from('agents')
                .select('user_id, payment_mode, mobile_money_orange, mobile_money_mtn, mobile_money_wave')
                .eq('id', agentId)
                .single()

            if (!agent) throw new Error('Agent not found')

            const services = products.filter(p => p.product_type === 'service')
            const service = services.find(s => s.name.toLowerCase().includes(service_name.toLowerCase()))

            if (!service) {
                const availableServices = services.map(s => s.name).join(', ')
                return JSON.stringify({
                    success: false,
                    error: `Service "${service_name}" non trouvé. Services disponibles : ${availableServices || 'Aucun'}`
                })
            }

            const normalizedPhone = normalizePhoneNumber(customer_phone)

            const { data: booking, error } = await supabase
                .from('bookings')
                .insert({
                    user_id: agent.user_id,
                    agent_id: agentId,
                    customer_phone: normalizedPhone,
                    customer_name: customer_name || null,
                    service_name: service.name,
                    service_id: service.id,
                    price_fcfa: service.price_fcfa || 0,
                    preferred_date: preferred_date,
                    preferred_time: preferred_time || null,
                    location: location || null,
                    notes: notes || null,
                    status: 'scheduled',
                    conversation_id: conversationId
                })
                .select()
                .single()

            if (error) throw error

            return JSON.stringify({
                success: true,
                booking_id: booking.id,
                message: `📅 Réservation créée ! Service: ${service.name}, Date: ${preferred_date}`
            })

        } catch (error) {
            console.error('Booking Error:', error)
            return JSON.stringify({
                success: false,
                error: error.message || 'Erreur lors de la réservation'
            })
        }
    }

    return JSON.stringify({ success: false, error: 'Unknown tool' })
}

module.exports = { TOOLS, handleToolCall }
