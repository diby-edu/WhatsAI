/**
 * ═══════════════════════════════════════════════════════════════
 * TOOLS.JS v2.7 - VERSION CONSOLIDÉE (AUDIT COMPLET)
 * ═══════════════════════════════════════════════════════════════
 * 
 * CORRECTIONS INCLUSES :
 * ✅ #1 : Matching flexible des variantes (v2.6)
 * ✅ #4 : Logs pour produits sans variantes
 * ✅ Export de findMatchingOption pour pre-check
 * ✅ Logs améliorés pour debug complet
 * ✅ Gestion d'erreurs robuste
 */

const { normalizePhoneNumber } = require('../utils/format')
const sharp = require('sharp')

// ═══════════════════════════════════════════════════════════════
// 🔒 HELPER : MASQUAGE DONNÉES SENSIBLES (RGPD)
// ═══════════════════════════════════════════════════════════════

/**
 * Masque les données sensibles pour les logs
 * @param {Object} obj - Objet à sanitizer
 * @returns {Object} - Copie avec données masquées
 */
function sanitizeForLog(obj) {
    if (!obj || typeof obj !== 'object') return obj
    const sanitized = { ...obj }

    // Masquer téléphone (garder les 5 premiers caractères)
    if (sanitized.customer_phone) {
        sanitized.customer_phone = sanitized.customer_phone.slice(0, 5) + '****'
    }

    // Masquer adresse
    if (sanitized.delivery_address) {
        sanitized.delivery_address = '[MASKED]'
    }

    // Masquer email
    if (sanitized.email) {
        const parts = sanitized.email.split('@')
        sanitized.email = parts[0].slice(0, 2) + '***@' + (parts[1] || '')
    }

    return sanitized
}

// ═══════════════════════════════════════════════════════════════
// DÉFINITION DES TOOLS OPENAI
// ═══════════════════════════════════════════════════════════════


const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: `Créer une commande pour un client.

IMPORTANT - VARIANTES :
- Si un produit a des variantes (taille, couleur, etc.), tu DOIS les spécifier dans 'selected_variants'
- Collecte TOUTES les variantes AVANT d'appeler cette fonction
- Exemple: selected_variants: {"Taille": "Petite", "Couleur": "Bleu"}
- Les noms courts suffisent: "Petite" matchera "Petite (50g)"`,
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
                                    description: 'Nom du produit (sans les variantes)'
                                },
                                quantity: {
                                    type: 'integer',
                                    description: 'Quantité'
                                },
                                selected_variants: {
                                    type: 'object',
                                    description: 'Variantes sélectionnées. Ex: {"Taille": "Petite", "Couleur": "Rouge"}',
                                    additionalProperties: { type: 'string' }
                                }
                            },
                            required: ['product_name', 'quantity']
                        }
                    },
                    customer_name: { type: 'string', description: 'Nom complet du client' },
                    customer_phone: { type: 'string', description: 'Numéro de téléphone' },
                    delivery_address: { type: 'string', description: 'Adresse de livraison complète' },
                    email: { type: 'string', description: 'Email (requis pour produits numériques)' },
                    payment_method: { type: 'string', enum: ['online', 'cod'], description: 'Mode de paiement' },
                    notes: { type: 'string', description: 'Instructions spéciales' }
                },
                required: ['items', 'customer_name', 'customer_phone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'check_payment_status',
            description: 'Vérifier le statut d\'une commande.',
            parameters: {
                type: 'object',
                properties: {
                    order_id: { type: 'string', description: 'ID de la commande (UUID)' }
                },
                required: ['order_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_image',
            description: 'Envoyer l\'image d\'un produit au client.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: { type: 'string', description: 'Nom du produit' },
                    variant_value: { type: 'string', description: 'Variante spécifique (optionnel)' }
                },
                required: ['product_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_booking',
            description: 'Créer une réservation pour un service.',
            parameters: {
                type: 'object',
                properties: {
                    service_name: { type: 'string', description: 'Nom du service' },
                    customer_phone: { type: 'string', description: 'Téléphone du client' },
                    customer_name: { type: 'string', description: 'Nom du client' },
                    preferred_date: { type: 'string', description: 'Date souhaitée (YYYY-MM-DD)' },
                    preferred_time: { type: 'string', description: 'Heure souhaitée (HH:MM)' },
                    location: { type: 'string', description: 'Lieu du service' },
                    notes: { type: 'string', description: 'Notes supplémentaires' }
                },
                required: ['service_name', 'customer_phone', 'preferred_date']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'find_order',
            description: 'Trouver les dernières commandes d\'un client par son numéro de téléphone.',
            parameters: {
                type: 'object',
                properties: {
                    phone_number: { type: 'string', description: 'Numéro de téléphone du client' }
                },
                required: ['phone_number']
            }
        }
    }
]

// ═══════════════════════════════════════════════════════════════
// 🔧 HELPER : MATCHING FLEXIBLE DES VARIANTES (EXPORTÉ)
// ═══════════════════════════════════════════════════════════════

/**
 * Trouve l'option correspondante avec matching flexible
 * "Petite" matche "Petite (50g)"
 * "Or Premium" matche "Or Premium"
 * 
 * @param {Object} variant - L'objet variante du produit
 * @param {string} selectedValue - La valeur envoyée par l'IA
 * @returns {Object|string|null} - L'option trouvée ou null
 */
function findMatchingOption(variant, selectedValue) {
    if (!selectedValue || !variant.options) return null

    const selectedLower = selectedValue.toLowerCase().trim()

    for (const option of variant.options) {
        const optValue = (typeof option === 'string') ? option : (option.value || option.name || '')
        const optValueLower = optValue.toLowerCase().trim()

        // Matching flexible (ordre de priorité) :
        // 1. Égalité exacte
        if (optValueLower === selectedLower) {
            return option
        }
        // 2. L'option commence par la valeur ("Petite (50g)".startsWith("petite"))
        if (optValueLower.startsWith(selectedLower)) {
            return option
        }
        // 3. La valeur commence par l'option
        if (selectedLower.startsWith(optValueLower)) {
            return option
        }
        // 4. L'option contient la valeur
        if (optValueLower.includes(selectedLower)) {
            return option
        }
    }

    return null
}

/**
 * Récupère la valeur affichable d'une option
 */
function getOptionValue(option) {
    return (typeof option === 'string') ? option : (option.value || option.name || '')
}

/**
 * Récupère le prix d'une option
 */
function getOptionPrice(option) {
    return (typeof option === 'string') ? 0 : (option.price || 0)
}

// ═══════════════════════════════════════════════════════════════
// 🔧 TOOL EXECUTOR
// ═══════════════════════════════════════════════════════════════

async function handleToolCall(toolCall, agentId, customerPhone, products, conversationId, supabase, activeSessions, CinetPay) {

    // ═══════════════════════════════════════════════════════════
    // CREATE ORDER
    // ═══════════════════════════════════════════════════════════
    if (toolCall.function.name === 'create_order') {
        try {
            console.log('🛠️ Executing tool: create_order')
            const args = JSON.parse(toolCall.function.arguments)
            const { items, customer_name, customer_phone, delivery_address, email, payment_method, notes } = args

            // Préparer les notes
            let finalNotes = notes || ''
            if (email) finalNotes += `\n📧 Email: ${email}`

            // Récupérer l'agent
            const { data: agent } = await supabase
                .from('agents')
                .select('user_id, payment_mode, mobile_money_orange, mobile_money_mtn, mobile_money_wave, custom_payment_methods')
                .eq('id', agentId)
                .single()

            if (!agent) throw new Error('Agent not found')

            let total = 0
            const orderItems = []

            // Traiter chaque item
            for (const item of items) {
                console.log(`\n📦 Traitement: "${item.product_name}" x${item.quantity}`)

                // Recherche du produit (scoring)
                const searchTerms = item.product_name.toLowerCase().split(' ').filter(w => w.length > 2)
                const searchName = item.product_name.toLowerCase()

                let bestProduct = null
                let bestScore = 0

                for (const p of products) {
                    const productName = p.name.toLowerCase()
                    const productText = `${p.name} ${p.description || ''} ${p.ai_instructions || ''}`.toLowerCase()
                    let score = 0

                    if (productName === searchName) score = 100
                    else if (searchName.includes(productName) || productName.includes(searchName)) score = 50
                    else {
                        score = searchTerms.filter(term => productName.includes(term)).length * 10
                        if (score < 20) score += searchTerms.filter(term => productText.includes(term)).length * 2
                    }

                    if (score > bestScore) {
                        bestScore = score
                        bestProduct = p
                    }
                }

                const product = bestScore >= 10 ? bestProduct : null

                if (!product) {
                    console.log(`   ❌ Produit non trouvé`)
                    return JSON.stringify({
                        success: false,
                        error: `Produit "${item.product_name}" non trouvé. Disponibles: ${products.map(p => p.name).join(', ')}`
                    })
                }

                console.log(`   ✅ Produit trouvé: "${product.name}" (score: ${bestScore})`)

                let price = product.price_fcfa || 0

                // FIX #CRITIQUE : Si variantes FIXED, ne pas utiliser le prix parent (souvent MAX ou Placeholder)
                // Cela évite le bug où un T-shirt à 150 FCFA est facturé 25,000 FCFA car le parent a le prix max.
                if (product.variants && product.variants.some(v => v.type === 'fixed')) {
                    console.log(`   🛡️ Variantes FIXED détectées : Reset prix de base ${price} -> 0`)
                    price = 0
                }

                let matchedVariantOption = null

                // ═══════════════════════════════════════════════════════
                // GESTION DES VARIANTES
                // ═══════════════════════════════════════════════════════
                if (product.variants && product.variants.length > 0) {
                    console.log(`   📋 ${product.variants.length} variante(s) requise(s)`)
                    const matchedVariantsByType = {}

                    // MÉTHODE 1 : Via selected_variants (prioritaire)
                    if (item.selected_variants && typeof item.selected_variants === 'object') {
                        console.log(`   📦 selected_variants reçu:`, item.selected_variants)

                        for (const variant of product.variants) {
                            const variantNameLower = variant.name.toLowerCase()

                            // Chercher la valeur envoyée
                            const selectedEntry = Object.entries(item.selected_variants).find(
                                ([key]) => key.toLowerCase() === variantNameLower
                            )
                            const selectedValue = selectedEntry ? selectedEntry[1] : null

                            if (selectedValue) {
                                // 🎯 Matching flexible
                                const validOption = findMatchingOption(variant, selectedValue)

                                if (validOption) {
                                    const optionPrice = getOptionPrice(validOption)
                                    const optionValue = getOptionValue(validOption)

                                    if (variant.type === 'fixed') {
                                        price = optionPrice
                                    } else {
                                        price += optionPrice
                                    }

                                    matchedVariantsByType[variant.name] = optionValue
                                    console.log(`      ✅ ${variant.name}: "${selectedValue}" → "${optionValue}" (+${optionPrice} FCFA)`)
                                } else {
                                    const options = variant.options.map(o => getOptionValue(o)).join(', ')
                                    console.log(`      ❌ "${selectedValue}" invalide pour ${variant.name}. Options: ${options}`)
                                }
                            } else {
                                console.log(`      ⚠️ ${variant.name} non fourni dans selected_variants`)
                            }
                        }
                    }

                    // MÉTHODE 2 : Fallback - chercher dans product_name
                    for (const variant of product.variants) {
                        if (matchedVariantsByType[variant.name]) continue

                        for (const option of variant.options) {
                            const optValue = getOptionValue(option)
                            if (optValue && item.product_name.toLowerCase().includes(optValue.toLowerCase())) {
                                const optionPrice = getOptionPrice(option)
                                if (variant.type === 'fixed') price = optionPrice
                                else price += optionPrice
                                matchedVariantsByType[variant.name] = optValue
                                console.log(`      ✅ ${variant.name} trouvé dans nom: "${optValue}"`)
                                break
                            }
                        }
                    }

                    // Vérifier les variantes manquantes
                    const missingVariants = product.variants.filter(v => !matchedVariantsByType[v.name])

                    if (missingVariants.length > 0) {
                        const missingList = missingVariants.map(v => {
                            const opts = v.options.map(o => getOptionValue(o)).join(', ')
                            return `${v.name}: [${opts}]`
                        }).join(' | ')

                        console.log(`   ❌ Variantes manquantes: ${missingVariants.map(v => v.name).join(', ')}`)

                        return JSON.stringify({
                            success: false,
                            error: `VARIANTES MANQUANTES pour "${product.name}". Demandez: ${missingList}`,
                            missing_variants: missingVariants.map(v => ({
                                name: v.name,
                                options: v.options.map(o => getOptionValue(o))
                            })),
                            hint: 'Utilisez selected_variants. Exemple: {"Taille": "Petite"}'
                        })
                    }

                    matchedVariantOption = Object.values(matchedVariantsByType).join(', ')
                    console.log(`   ✅ Toutes variantes OK: ${matchedVariantOption}`)

                } else {
                    // FIX #4 : Log pour produits sans variantes
                    console.log(`   ℹ️ Pas de variantes requises`)
                }

                // Ajouter à la commande
                total += price * item.quantity
                orderItems.push({
                    product_name: matchedVariantOption
                        ? `${product.name} (${matchedVariantOption})`
                        : product.name,
                    product_description: product.description,
                    quantity: item.quantity,
                    unit_price_fcfa: price
                })

                console.log(`   💰 ${item.quantity}x @ ${price} FCFA = ${price * item.quantity} FCFA`)
            }

            // Créer la commande
            const normalizedPhone = normalizePhoneNumber(customer_phone || customerPhone)
            console.log(`\n📝 Création commande: ${orderItems.length} items, Total: ${total} FCFA`)

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

            // Ajouter les items
            if (orderItems.length > 0) {
                await supabase.from('order_items').insert(
                    orderItems.map(i => ({ ...i, order_id: order.id }))
                )
            }

            console.log(`✅ Commande créée: ${order.id}`)

            // Résumé des items pour l'IA
            const itemsSummary = orderItems.map(i => `- ${i.quantity}x ${i.product_name}`).join('\n')

            // Préparer la réponse selon le mode de paiement
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://whatsai.duckdns.org'

            if (payment_method === 'cod') {
                return JSON.stringify({
                    success: true,
                    order_id: order.id,
                    payment_method: 'cod',
                    items: itemsSummary,
                    message: `✅ Commande confirmée ! Nous préparons la livraison. 🚚\nPaiement de ${total} FCFA à prévoir à la livraison.`
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
                    items: itemsSummary,
                    message: `✅ Commande enregistrée en attente de paiement. Veuillez effectuer le transfert de ${total} FCFA.`
                })
            }

            // CinetPay (défaut)
            return JSON.stringify({
                success: true,
                order_id: order.id,
                total: total,
                payment_method: 'online',
                payment_link: `${appUrl}/pay/${order.id}`,
                items: itemsSummary,
                message: `✅ Commande créée ! Lien de paiement généré pour ${total} FCFA.`
            })


        } catch (error) {
            console.error('❌ Create Order Error:', error)
            return JSON.stringify({
                success: false,
                error: error.message || 'Erreur lors de la création de la commande'
            })
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CHECK PAYMENT STATUS
    // ═══════════════════════════════════════════════════════════
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
                return JSON.stringify({ success: false, error: `Commande ${order_id} introuvable.` })
            }

            const statusMessages = {
                'pending': `⏳ En attente de paiement. Total: ${order.total_fcfa} FCFA.`,
                'paid': `✅ Paiement confirmé ! En cours de traitement.`,
                'pending_delivery': `📦 En cours de livraison.`,
                'delivered': `🎉 Livrée avec succès !`,
                'cancelled': `❌ Commande annulée.`
            }

            return JSON.stringify({
                success: true,
                order_id: order.id,
                status: order.status,
                message: `Commande #${order.id.substring(0, 8)} : ${statusMessages[order.status] || order.status}`
            })

        } catch (error) {
            console.error('❌ Check Payment Error:', error)
            return JSON.stringify({ success: false, error: 'Erreur lors de la vérification.' })
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SEND IMAGE
    // ═══════════════════════════════════════════════════════════
    if (toolCall.function.name === 'send_image') {
        try {
            console.log('🛠️ Executing tool: send_image')
            const args = JSON.parse(toolCall.function.arguments)
            const { product_name, variant_value } = args

            const searchName = product_name.toLowerCase()
            const product = products.find(p =>
                p.name.toLowerCase() === searchName ||
                searchName.includes(p.name.toLowerCase()) ||
                p.name.toLowerCase().includes(searchName)
            )

            if (!product) {
                return JSON.stringify({ success: false, error: `Produit "${product_name}" introuvable.` })
            }

            let imageUrl = product.image_url

            // Chercher image de variante si spécifiée
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
                return JSON.stringify({ success: false, error: `Pas d'image pour "${product.name}".` })
            }

            const caption = variant_value
                ? `Voici ${product.name} (${variant_value}) !`
                : `Voici ${product.name} !`

            return JSON.stringify({
                success: true,
                action: 'send_image',
                image_url: imageUrl,
                caption: caption,
                product_name: product.name
            })

        } catch (error) {
            console.error('❌ Send Image Error:', error)
            return JSON.stringify({ success: false, error: 'Erreur lors de l\'envoi.' })
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CREATE BOOKING
    // ═══════════════════════════════════════════════════════════
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
                return JSON.stringify({
                    success: false,
                    error: `Service "${service_name}" non trouvé. Disponibles: ${services.map(s => s.name).join(', ') || 'Aucun'}`
                })
            }

            const { data: booking, error } = await supabase
                .from('bookings')
                .insert({
                    user_id: agent.user_id,
                    agent_id: agentId,
                    customer_phone: normalizePhoneNumber(customer_phone),
                    customer_name: customer_name || null,
                    service_name: service.name,
                    service_id: service.id,
                    price_fcfa: service.price_fcfa || 0,
                    preferred_date,
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
                message: `📅 Réservation créée ! ${service.name} le ${preferred_date}${preferred_time ? ` à ${preferred_time}` : ''}.`
            })

        } catch (error) {
            console.error('❌ Booking Error:', error)
            return JSON.stringify({ success: false, error: error.message || 'Erreur lors de la réservation' })
        }
    }



    // ═══════════════════════════════════════════════════════════
    // FIND ORDER (BY PHONE)
    // ═══════════════════════════════════════════════════════════
    if (toolCall.function.name === 'find_order') {
        try {
            console.log('🛠️ Executing tool: find_order')
            const args = JSON.parse(toolCall.function.arguments)
            const { phone_number } = args
            const normalizedPhone = normalizePhoneNumber(phone_number)

            if (!normalizedPhone) return JSON.stringify({ success: false, error: 'Numéro invalide' })

            const { data: orders } = await supabase
                .from('orders')
                .select('id, total_fcfa, status, created_at, items:order_items(product_name, quantity)')
                .eq('customer_phone', normalizedPhone)
                .order('created_at', { ascending: false })
                .limit(3)

            if (!orders || orders.length === 0) {
                return JSON.stringify({ success: true, message: 'Aucune commande trouvée pour ce numéro.' })
            }

            // Formater pour l'IA
            const ordersList = orders.map(o => {
                const date = new Date(o.created_at).toLocaleDateString('fr-FR')
                const items = o.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')
                return `- Commande #${o.id.substring(0, 8)} du ${date} (${o.total_fcfa} FCFA) : ${o.status}\n  Articles: ${items}`
            }).join('\n\n')

            return JSON.stringify({
                success: true,
                message: `Voici les dernières commandes trouvées :\n${ordersList}`
            })

        } catch (error) {
            console.error('❌ Find Order Error:', error)
            return JSON.stringify({ success: false, error: 'Erreur lors de la recherche.' })
        }
    }

    return JSON.stringify({ success: false, error: 'Outil inconnu' })
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    TOOLS,
    handleToolCall,
    findMatchingOption,  // Exporté pour le pre-check dans generator.js
    getOptionValue,
    getOptionPrice
}
