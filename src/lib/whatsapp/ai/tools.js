const { normalizePhoneNumber } = require('../utils/format')
const sharp = require('sharp')

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: 'Create a new order for a customer. Use this when the user wants to buy something.',
            parameters: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                product_name: { type: 'string', description: 'Name of the product from the catalog' },
                                quantity: { type: 'integer', description: 'Quantity ordered' }
                            },
                            required: ['product_name', 'quantity']
                        },
                        description: 'List of products to order'
                    },
                    customer_phone: { type: 'string', description: 'Customer phone number (required)' },
                    delivery_address: { type: 'string', description: 'Delivery address provided by user (required for physical products)' },
                    delivery_city: { type: 'string', description: 'Delivery city' },
                    email: { type: 'string', description: 'Customer email (required for digital products)' },
                    payment_method: { type: 'string', enum: ['online', 'cod'], description: 'Payment method choice' },
                    notes: { type: 'string', description: 'Any special instructions' }
                },
                required: ['items', 'customer_phone']
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
            description: 'Send an image of a product to the customer. Use this when showing a product. If customer asks for a specific color/variant (Rouge, Bleu, etc.), specify variant_value to show the variant-specific image.',
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
 * Tool Executor
 * @param {Object} toolCall The tool call object from OpenAI
 * @param {string} agentId Agent ID
 * @param {string} customerPhone Customer Phone
 * @param {Array} products List of products
 * @param {string} conversationId Conversation ID
 * @param {Object} supabase Supabase Instance
 * @param {Map} activeSessions Active Sessions Map (needed for sendMessage)
 * @param {Function} CinetPay CinetPay Constructor (dependency injection)
 * @returns {Promise<string>} Tool execution result
 */
async function handleToolCall(toolCall, agentId, customerPhone, products, conversationId, supabase, activeSessions, CinetPay) {
    if (toolCall.function.name === 'create_order') {
        try {
            console.log('🛠️ Executing tool: create_order')
            const args = JSON.parse(toolCall.function.arguments)
            const { items, customer_phone, delivery_address, delivery_city, email, payment_method, notes } = args

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

                    if (product.variants && product.variants.length > 0) {
                        const matchedVariantsByType = {}

                        for (const variant of product.variants) {
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
                                    break
                                }
                            }
                        }

                        const unMatchedVariants = product.variants.filter(v => !matchedVariantsByType[v.name])

                        if (unMatchedVariants.length > 0) {
                            console.log('❌ Missing variant types:', unMatchedVariants.map(v => v.name).join(', '))
                            const missingOptions = unMatchedVariants.map(v =>
                                `${v.name}: ${v.options.map(o => o.value || o.name).join(', ')}`
                            ).join(' | ')

                            return JSON.stringify({
                                success: false,
                                error: `Pour commander "${product.name}", veuillez préciser: ${missingOptions}`,
                                product_name: product.name,
                                missing_variants: unMatchedVariants.map(v => ({
                                    name: v.name,
                                    options: v.options.map(o => o.value || o.name)
                                }))
                            })
                        }
                        matchedVariantOption = Object.values(matchedVariantsByType).join(', ')
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

            const { data: order, error } = await supabase
                .from('orders')
                .insert({
                    user_id: agent.user_id,
                    agent_id: agentId,
                    customer_phone: normalizedPhone,
                    status: payment_method === 'cod' ? 'pending_delivery' : 'pending',
                    total_fcfa: total,
                    delivery_address: `${delivery_address || ''} ${delivery_city || ''}`.trim(),
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

            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://whatsai.duckdns.org'

            if (payment_method === 'cod') {
                return JSON.stringify({
                    success: true,
                    order_id: order.id,
                    payment_method: 'cod',
                    message: `Commande #${order.id.substring(0, 8)} créée. Total: ${total} FCFA. Paiement à la livraison.`
                })
            } else if (agent.payment_mode === 'mobile_money_direct') {
                const paymentMethods = []
                if (agent.mobile_money_orange) paymentMethods.push(`🟠 Orange Money : ${agent.mobile_money_orange}`)
                if (agent.mobile_money_mtn) paymentMethods.push(`🟡 MTN Money : ${agent.mobile_money_mtn}`)
                if (agent.mobile_money_wave) paymentMethods.push(`🔵 Wave : ${agent.mobile_money_wave}`)

                if (agent.custom_payment_methods && Array.isArray(agent.custom_payment_methods)) {
                    for (const method of agent.custom_payment_methods) {
                        if (method.name && method.details) {
                            paymentMethods.push(`📱 ${method.name} : ${method.details}`)
                        }
                    }
                }

                await supabase.from('orders').update({
                    payment_verification_status: 'awaiting_screenshot'
                }).eq('id', order.id)

                return JSON.stringify({
                    success: true,
                    order_id: order.id,
                    payment_method: 'mobile_money_direct',
                    payment_methods: paymentMethods,
                    message: `Commande #${order.id.substring(0, 8)} créée. Total: ${total} FCFA.\n\n📱 *Choisissez votre mode de paiement :*\n${paymentMethods.join('\n')}\n\n⚠️ Après le paiement, envoyez une capture d'écran pour confirmation.`
                })
            } else {
                return JSON.stringify({
                    success: true,
                    order_id: order.id,
                    payment_method: 'online',
                    message: `Commande #${order.id.substring(0, 8)} créée. Total: ${total} FCFA.`,
                    payment_link: `${appUrl}/pay/${order.id}`
                })
            }

        } catch (error) {
            console.error('Tool Execution Error:', error)
            return JSON.stringify({ success: false, error: error.message })
        }
    }

    if (toolCall.function.name === 'check_payment_status') {
        try {
            console.log('🛠️ Executing tool: check_payment_status')
            const args = JSON.parse(toolCall.function.arguments)
            const { order_id } = args

            const { data: order, error } = await supabase
                .from('orders')
                .select('id, status, total_fcfa, payment_method, cinetpay_transaction_id, cinetpay_payment_url')
                .eq('id', order_id)
                .single()

            if (error || !order) {
                return JSON.stringify({ success: false, error: 'Commande introuvable' })
            }

            let statusMessage = ''
            switch (order.status) {
                case 'paid':
                    statusMessage = `✅ Le paiement de ${order.total_fcfa} FCFA a bien été reçu ! La commande est confirmée.`
                    break
                case 'pending':
                    statusMessage = `⏳ Le paiement est en attente. Le client doit encore payer ${order.total_fcfa} FCFA.`
                    if (order.payment_method === 'online' && order.cinetpay_transaction_id) {
                        try {
                            // CinetPay is now the module { checkPaymentStatus }
                            const checkStatus = await CinetPay.checkPaymentStatus(order.cinetpay_transaction_id)

                            if (checkStatus.success && checkStatus.status === 'ACCEPTED') {
                                await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id)
                                statusMessage = `✅ Le paiement de ${order.total_fcfa} FCFA a bien été reçu ! La commande est confirmée.`
                            } else {
                                statusMessage = `⏳ Le paiement est en attente. Le client doit encore payer ${order.total_fcfa} FCFA. Vous pouvez payer ici: ${order.cinetpay_payment_url}`
                            }
                        } catch (apiError) {
                            console.error('CinetPay Verify Error:', apiError)
                            return JSON.stringify({
                                success: false,
                                status: 'pending',
                                message: `⏳ Vérification temporairement indisponible. Si vous avez déjà payé, votre commande sera confirmée dans quelques instants. Sinon, vous pouvez payer ici:\n${order.cinetpay_payment_url}`
                            })
                        }
                    }
                    break
                case 'pending_delivery':
                    statusMessage = `📦 Commande en attente de livraison (paiement à la livraison: ${order.total_fcfa} FCFA).`
                    break
                case 'delivered':
                    statusMessage = `✅ La commande a été livrée et payée.`
                    break
                case 'scheduled':
                    statusMessage = `📅 Votre service est confirmé et planifié. Nous vous contacterons pour confirmer les détails.`
                    break
                case 'in_progress':
                    statusMessage = `🔧 Votre service est actuellement en cours. Merci de patienter.`
                    break
                case 'completed':
                    statusMessage = `✅ Votre service a été effectué avec succès. Merci pour votre confiance !`
                    break
                case 'cancelled':
                    statusMessage = `❌ Cette commande/réservation a été annulée.`
                    break
                default:
                    return JSON.stringify({
                        success: true,
                        status: order.status,
                        message: `Statut actuel: ${order.status}`
                    })
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
                error: 'Une erreur est survenue lors de la vérification. Veuillez réessayer.'
            })
        }
    }

    if (toolCall.function.name === 'send_image') {
        try {
            console.log('🛠️ Executing tool: send_image')
            const args = JSON.parse(toolCall.function.arguments)
            const { product_name, variant_value } = args

            const searchTerms = product_name.toLowerCase().split(' ').filter(w => w.length > 2)
            const searchName = product_name.toLowerCase()

            let bestProduct = null
            let bestScore = 0

            for (const p of products) {
                const productName = p.name.toLowerCase()
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
                }

                if (score > bestScore) {
                    bestScore = score
                    bestProduct = p
                }
            }

            const product = bestScore >= 10 ? bestProduct : null

            if (!product) {
                const availableProducts = products.map(p => p.name).join(', ')
                return JSON.stringify({
                    success: false,
                    error: `Je ne trouve pas "${product_name}" dans notre catalogue. Produits disponibles : ${availableProducts}`
                })
            }

            let imageToSend = null
            let imageCaption = `Voici ${product.name} ! 📸`

            if (variant_value && product.variants && product.variants.length > 0) {
                for (const variant of product.variants) {
                    const category = variant.category || 'custom'
                    if (category === 'visual' || category === 'custom') {
                        for (const option of variant.options || []) {
                            if (option.value && option.value.toLowerCase() === variant_value.toLowerCase()) {
                                if (option.image) {
                                    imageToSend = option.image
                                    imageCaption = `Voici ${product.name} en ${option.value} ! 📸`
                                }
                                break
                            }
                        }
                    }
                    if (imageToSend) break
                }
            }

            if (!imageToSend) {
                imageToSend = product.image_url || (product.images && product.images[0])
            }

            if (!imageToSend) {
                return JSON.stringify({
                    success: false,
                    error: `Désolé, je n'ai pas encore d'image pour "${product.name}".`
                })
            }

            const session = activeSessions.get(agentId)
            if (session && session.socket) {
                let jid = customerPhone
                if (!jid || jid === 'undefined' || jid === 'null') {
                    return JSON.stringify({
                        success: false,
                        error: "Erreur interne: numéro de téléphone non disponible"
                    })
                }

                if (!jid.includes('@')) {
                    jid = jid.toString().replace(/\D/g, '') + '@s.whatsapp.net'
                }

                try {
                    let imageBuffer = null
                    let compressedBuffer = null

                    try {
                        const imageResponse = await fetch(imageToSend)
                        if (imageResponse.ok) {
                            imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
                            try {
                                compressedBuffer = await sharp(imageBuffer)
                                    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                                    .jpeg({ quality: 80 })
                                    .toBuffer()
                            } catch (compressError) {
                                console.warn('⚠️ Compression failed, will use original:', compressError.message)
                            }
                        }
                    } catch (downloadError) {
                        console.warn('⚠️ Failed to download image, will try URL method:', downloadError.message)
                    }

                    const bufferToSend = compressedBuffer || imageBuffer

                    if (bufferToSend && bufferToSend.length > 0) {
                        await session.socket.sendMessage(jid, {
                            image: bufferToSend,
                            caption: imageCaption
                        })
                    } else {
                        await session.socket.sendMessage(jid, {
                            image: { url: imageToSend },
                            caption: imageCaption
                        })
                    }
                } catch (sendError) {
                    throw new Error(`Erreur envoi image WhatsApp: ${sendError.message}`)
                }
            } else {
                return JSON.stringify({
                    success: false,
                    error: "Session WhatsApp non disponible"
                })
            }

            return JSON.stringify({
                success: true,
                message: `J'ai envoyé une photo de ${product.name} !`
            })

        } catch (error) {
            console.error('Send Image Error:', error)
            return JSON.stringify({ success: false, error: "Impossible d'envoyer l'image." })
        }
    }

    if (toolCall.function.name === 'create_booking') {
        try {
            console.log('🛠️ Executing tool: create_booking')
            const args = JSON.parse(toolCall.function.arguments)
            const { service_name, customer_phone, customer_name, preferred_date, preferred_time, location, notes } = args

            const { data: agent } = await supabase
                .from('agents')
                .select('user_id, payment_mode, mobile_money_orange, mobile_money_mtn, mobile_money_wave, custom_payment_methods')
                .eq('id', agentId)
                .single()
            if (!agent) throw new Error('Agent not found')

            const service = products.find(p =>
                p.product_type === 'service' &&
                (p.name.toLowerCase().includes(service_name.toLowerCase()) ||
                    service_name.toLowerCase().includes(p.name.toLowerCase()))
            )

            if (!service) {
                const availableServices = products.filter(p => p.product_type === 'service').map(p => p.name).join(', ')
                return JSON.stringify({
                    success: false,
                    error: `Service "${service_name}" non trouvé. Services disponibles : ${availableServices || 'Aucun service disponible'}`
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

            let paymentInfo = ''
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://whatsai.duckdns.org'

            if (agent.payment_mode === 'mobile_money_direct') {
                const paymentMethods = []
                if (agent.mobile_money_orange) paymentMethods.push(`🟠 Orange Money : ${agent.mobile_money_orange}`)
                if (agent.mobile_money_mtn) paymentMethods.push(`🟡 MTN Money : ${agent.mobile_money_mtn}`)
                if (agent.mobile_money_wave) paymentMethods.push(`🔵 Wave : ${agent.mobile_money_wave}`)

                if (paymentMethods.length > 0) {
                    paymentInfo = `\n\n📱 Pour confirmer votre réservation, effectuez le paiement de ${service.price_fcfa} FCFA :\n${paymentMethods.join('\n')}\n\n⚠️ Envoyez-nous la capture d'écran du paiement.`
                }
            } else {
                paymentInfo = `\n\n💳 Pour confirmer, finalisez le paiement ici : ${appUrl}/pay/booking/${booking.id}`
            }

            return JSON.stringify({
                success: true,
                booking_id: booking.id,
                message: `📅 Réservation créée !\n\n🛠️ Service: ${service.name}\n📆 Date: ${preferred_date}${preferred_time ? ` à ${preferred_time}` : ''}\n📍 Lieu: ${location || 'À confirmer'}\n💰 Tarif: ${service.price_fcfa} FCFA${paymentInfo}`
            })

        } catch (error) {
            console.error('Booking Creation Error:', error)
            return JSON.stringify({
                success: false,
                error: error.message || 'Erreur lors de la création de la réservation'
            })
        }
    }

    return JSON.stringify({ success: false, error: 'Unknown tool' })
}

module.exports = { TOOLS, handleToolCall }
