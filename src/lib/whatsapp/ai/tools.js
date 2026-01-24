/**
 * ═══════════════════════════════════════════════════════════════
 * TOOLS.JS v2.26 - EMAIL REQUIS POUR PRODUITS NUMÉRIQUES
 * ═══════════════════════════════════════════════════════════════
 *
 * changelog:
 * ✅ v2.26 : Validation email obligatoire pour product_type === 'digital'
 * ✅ v2.25 : send_image supporte selected_variants (findMatchingOption)
 * ✅ v2.24 : Fix 'variants' ReferenceError (line 450)
 * ✅ v2.23 : 'var price' (scope global function), safe import normalizePhoneNumber
 */

console.log("🚀 TOOLS.JS v2.26 LOADED - EMAIL REQUIRED FOR DIGITAL")

// ═══════════════════════════════════════════════════════════════
// 📞 HELPER : NORMALIZE PHONE NUMBER (INLINED SAFETY)
// ═══════════════════════════════════════════════════════════════
function normalizePhoneNumber(phone, defaultCountryCode = '225') {
    if (!phone) {
        return '+000000000000'
    }

    let normalized = phone.toString().trim()
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '')

    if (normalized.startsWith('00')) normalized = '+' + normalized.substring(2)
    if (normalized.startsWith('+')) return normalized

    // 4. INDICATIFS CONNUS
    const countryPatterns = [{ prefix: '225' }, { prefix: '33' }, { prefix: '1' }]
    for (const pattern of countryPatterns) {
        if (normalized.startsWith(pattern.prefix)) return '+' + normalized
    }

    // 5. NUMÉRO LOCAL (commence par 0)
    if (normalized.startsWith('0') && normalized.length >= 8) {
        return '+' + defaultCountryCode + normalized.substring(1)
    }

    // 7. FALLBACK
    return '+' + defaultCountryCode + normalized.replace(/\D/g, '')
}
console.log("✅ normalizePhoneNumber INLINED OK")


// ═══════════════════════════════════════════════════════════════
// FONCTION HELPER : Vérifier si un produit a VRAIMENT des variantes
// ═══════════════════════════════════════════════════════════════

/**
 * Vérifie si un produit a des variantes RÉELLES (pas juste un array vide)
 * @param {Object} product - Le produit à vérifier
 * @returns {boolean} - true si le produit a des variantes avec des options
 */
function productHasRealVariants(product) {
    // Pas de variantes du tout
    if (!product.variants) return false

    // Array vide
    if (!Array.isArray(product.variants)) return false
    if (product.variants.length === 0) return false

    // Vérifier que chaque variante a des options
    for (const variant of product.variants) {
        if (!variant.options || !Array.isArray(variant.options) || variant.options.length === 0) {
            continue // Cette variante est vide, ignorer
        }
        // Au moins une variante a des options
        return true
    }

    // Toutes les variantes sont vides
    return false
}

// ═══════════════════════════════════════════════════════════════
// FONCTION HELPER : Vérifier le stock
// ═══════════════════════════════════════════════════════════════

/**
 * Vérifie si le stock est suffisant
 * @param {Object} product - Le produit
 * @param {number} quantity - La quantité demandée
 * @returns {Object} - { ok: boolean, available: number, message: string }
 */
function checkStock(product, quantity) {
    // Stock illimité (-1 ou null)
    if (product.stock_quantity === -1 || product.stock_quantity === null || product.stock_quantity === undefined) {
        return { ok: true, available: Infinity, message: 'Stock illimité' }
    }

    // Stock suffisant
    if (product.stock_quantity >= quantity) {
        return { ok: true, available: product.stock_quantity, message: 'Stock OK' }
    }

    // Stock insuffisant
    return {
        ok: false,
        available: product.stock_quantity,
        message: `Stock insuffisant. Disponible: ${product.stock_quantity}, Demandé: ${quantity}`
    }
}

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
                    selected_variants: {
                        type: 'object',
                        description: 'Variantes sélectionnées. Ex: {"Couleur": "Rouge"}',
                        additionalProperties: { type: 'string' }
                    },
                    variant_value: { type: 'string', description: 'OBSOLÈTE (Utiliser selected_variants)' }
                },
                required: ['product_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_booking',
            description: 'Créer une réservation pour un service (hôtel, restaurant, salon, consulting, etc.).',
            parameters: {
                type: 'object',
                properties: {
                    booking_type: { type: 'string', description: 'Type de réservation: "stay" (hôtel), "table" (restaurant), "slot" (rdv), "rental" (location)' },
                    service_name: { type: 'string', description: 'Nom du service/produit dans le catalogue (ex: "Chambres", "Menu Gourmet")' },
                    selected_variant: { type: 'string', description: 'Variante choisie (ex: "Suite", "VIP", "Menu Découverte") - OBLIGATOIRE si le service a des variantes' },
                    customer_phone: { type: 'string', description: 'Téléphone du client (avec indicatif)' },
                    customer_name: { type: 'string', description: 'Nom du client' },
                    preferred_date: { type: 'string', description: 'Date de début (YYYY-MM-DD)' },
                    preferred_time: { type: 'string', description: 'Heure (HH:MM) - pour table/slot' },
                    end_date: { type: 'string', description: 'Date de fin (YYYY-MM-DD) - pour stay/rental' },
                    party_size: { type: 'number', description: 'Nombre de personnes/couverts' },
                    selected_supplements: { type: 'object', description: 'Suppléments choisis (ex: {"Petit déjeuner": true, "Deuxième lit": true})' },
                    notes: { type: 'string', description: 'Demandes spéciales (allergies, préférences, etc.)' }
                },
                required: ['booking_type', 'service_name', 'customer_phone', 'customer_name', 'preferred_date']
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

async function handleToolCall(toolCall, agentId, customerPhone, products, conversationId, supabase, _activeSessions, _CinetPay) {

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
                .select('user_id, payment_mode, mobile_money_orange, mobile_money_mtn, mobile_money_wave, custom_payment_methods, escalation_phone')
                .eq('id', agentId)
                .single()

            if (!agent) throw new Error('Agent not found')

            // ═══════════════════════════════════════════════════════════
            // ⭐ VALIDATION EMAIL POUR PRODUITS NUMÉRIQUES (v2.26)
            // ═══════════════════════════════════════════════════════════
            // Vérifier si un produit numérique est dans la commande
            const hasDigitalProduct = items.some(item => {
                const searchName = item.product_name.toLowerCase()
                const matchedProduct = products.find(p => {
                    const pName = p.name.toLowerCase()
                    return pName === searchName || searchName.includes(pName) || pName.includes(searchName)
                })
                return matchedProduct && matchedProduct.product_type === 'digital'
            })

            if (hasDigitalProduct && !email) {
                console.log('❌ Email requis pour produit numérique mais non fourni')
                return JSON.stringify({
                    success: false,
                    error: 'EMAIL REQUIS. Ce produit numérique sera envoyé par email. Demande l\'adresse email du client avant de créer la commande.',
                    hint: 'Demande : "À quelle adresse email souhaitez-vous recevoir votre produit ?"'
                })
            }

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

                // ═══════════════════════════════════════════════════════
                // VÉRIFICATION DU STOCK (NOUVEAU v2.10)
                // ═══════════════════════════════════════════════════════
                const stockCheck = checkStock(product, item.quantity)
                if (!stockCheck.ok) {
                    console.log(`   ❌ Stock insuffisant: ${stockCheck.message}`)
                    return JSON.stringify({
                        success: false,
                        error: `Stock insuffisant pour "${product.name}". ${stockCheck.available > 0 ? `Seulement ${stockCheck.available} disponible(s).` : 'Produit épuisé.'}`,
                        available_stock: stockCheck.available,
                        hint: stockCheck.available > 0
                            ? `Proposez ${stockCheck.available} unités ou un produit alternatif.`
                            : 'Proposez un produit alternatif.'
                    })
                }
                console.log(`   ✅ Stock OK: ${stockCheck.available === Infinity ? 'illimité' : stockCheck.available}`)

                // ═══════════════════════════════════════════════════════
                // GESTION DU PRIX ET DES VARIANTES (v2.12 - HYBRID LOGIC)
                // ═══════════════════════════════════════════════════════
                // Logique Simplifiée :
                // 1. Base Price = Product Price
                // 2. Si Variante Prix > 0 (et pas supplément) → Remplace Base Price
                // 3. Si Variante Type = 'supplement' → Ajoute au Total

                // Initialiser le prix avec le prix de base par défaut (SAFE SCOPE)
                let price = product.price_fcfa || 0
                let effectiveBasePrice = price
                let totalSupplements = 0
                let matchedVariantOption = null

                // Vérifier si le produit a des variantes RÉELLES
                let variants = []
                if (productHasRealVariants(product)) {
                    console.log(`   📋 Produit avec variantes RÉELLES`)

                    variants = product.variants // ✅ FIX ReferenceError v2.25 (Scope Fix)
                    const matchedVariantsByType = {}

                    // Fusionner les sources de variantes (priorité à selected_variants de l'outil, fallback sur analyse de texte dans product_name)
                    // Cette étape construit une map "NomVariante" -> "ValeurOption"

                    // A. Extract from explicit selection
                    if (item.selected_variants && typeof item.selected_variants === 'object') {
                        Object.entries(item.selected_variants).forEach(([k, v]) => {
                            // Find exact variant name check
                            const targetVariant = product.variants.find(pv => pv.name.toLowerCase() === k.toLowerCase())
                            if (targetVariant) matchedVariantsByType[targetVariant.name] = v
                        })
                    }

                    // B. Extract from product name (fallback)
                    product.variants.forEach(variant => {
                        if (matchedVariantsByType[variant.name]) return // Déjà trouvé
                        if (!variant.options || variant.options.length === 0) return

                        for (const option of variant.options) {
                            const optValue = getOptionValue(option)
                            // Simple includes check - can be fragile but aligns with existing logic
                            if (optValue && item.product_name.toLowerCase().includes(optValue.toLowerCase())) {
                                matchedVariantsByType[variant.name] = optValue
                                break
                            }
                        }
                    })

                    // C. CALCULATE PRICE based on matched variants
                    for (const variant of product.variants) {
                        const selectedValue = matchedVariantsByType[variant.name]
                        if (selectedValue) {
                            const validOption = findMatchingOption(variant, selectedValue)
                            if (validOption) {
                                const optionPrice = getOptionPrice(validOption)

                                if (variant.type === 'additive' || variant.type === 'supplement') {
                                    totalSupplements += optionPrice
                                    console.log(`      ➕ Supplément "${variant.name}": +${optionPrice} FCFA`)
                                } else {
                                    if (optionPrice > 0) {
                                        effectiveBasePrice = optionPrice
                                        console.log(`      🔄 Remplacement Base "${variant.name}": ${optionPrice} FCFA`)
                                    } else {
                                        console.log(`      ⏹️ Maintien Base "${variant.name}": (0 FCFA)`)
                                    }
                                }
                                // Update matched value for description
                                matchedVariantsByType[variant.name] = getOptionValue(validOption)
                            }
                        }
                    }

                    // 3. Calcul Final du Prix (Base + Supplément)
                    price = effectiveBasePrice + totalSupplements
                    matchedVariantOption = Object.values(matchedVariantsByType).join(', ')

                    // 4. Check Manquants
                    const missingVariants = variants.filter(v =>
                        v.options && v.options.length > 0 && !matchedVariantsByType[v.name]
                    )

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

                    console.log(`      ✅ Variants validés: ${matchedVariantOption}`)
                    console.log(`      💵 Prix calculé: ${effectiveBasePrice} (Base) + ${totalSupplements} (Supp) = ${price} FCFA`)

                } else {
                    console.log(`   ℹ️ Produit SANS variantes - Prix: ${price} FCFA`)
                }

                // AJOUT A LA COMMANDE
                total += price * item.quantity
                orderItems.push({
                    product_name: matchedVariantOption ? `${product.name} (${matchedVariantOption})` : product.name,
                    product_description: product.description,
                    quantity: item.quantity,
                    unit_price_fcfa: price
                })

                console.log(`   💰 ${item.quantity}x @ ${price} FCFA = ${price * item.quantity} FCFA`)
            }

            // Créer la commande
            const safeNormalize = (phone) => {
                // Assuming normalizePhoneNumber is imported or globally available.
                // If not, this check prevents a ReferenceError.
                if (typeof normalizePhoneNumber === 'function') {
                    return normalizePhoneNumber(phone)
                }
                console.error("❌ CRITICAL: normalizePhoneNumber is not a function! Falling back to simple strip.")
                return phone ? phone.replace(/\D/g, '') : ''
            }
            const normalizedPhone = safeNormalize(customer_phone || customerPhone)
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
                let msg = `✅ Commande confirmée ! Nous préparons la livraison. 🚚\nPaiement de ${total} FCFA à prévoir à la livraison.`
                if (agent.escalation_phone) msg += `\n\n📞 En cas de besoin, contactez le service client au ${agent.escalation_phone}.`

                return JSON.stringify({
                    success: true,
                    order_id: order.id,
                    payment_method: 'cod',
                    items: itemsSummary,
                    message: msg
                })
            }

            if (agent.payment_mode === 'mobile_money_direct') {
                const paymentMethods = []
                if (agent.mobile_money_orange) paymentMethods.push({ type: 'Orange Money', number: agent.mobile_money_orange })
                if (agent.mobile_money_mtn) paymentMethods.push({ type: 'MTN Money', number: agent.mobile_money_mtn })
                if (agent.mobile_money_wave) paymentMethods.push({ type: 'Wave', number: agent.mobile_money_wave })

                let msg = `✅ Commande enregistrée en attente de paiement. Veuillez effectuer le transfert de ${total} FCFA.`
                if (agent.escalation_phone) msg += `\n\n📞 En cas de besoin, contactez le service client au ${agent.escalation_phone}.`

                return JSON.stringify({
                    success: true,
                    order_id: order.id,
                    total: total,
                    payment_method: 'mobile_money_direct',
                    payment_methods: paymentMethods,
                    items: itemsSummary,
                    message: msg
                })
            }

            // CinetPay (défaut)
            let msg = `✅ Commande créée ! Lien de paiement généré pour ${total} FCFA.`
            if (agent.escalation_phone) msg += `\n\n📞 En cas de besoin, contactez le service client au ${agent.escalation_phone}.`

            return JSON.stringify({
                success: true,
                order_id: order.id,
                total: total,
                payment_method: 'online',
                payment_link: `${appUrl}/pay/${order.id}`,
                items: itemsSummary,
                message: msg
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
            let { product_name, variant_value, selected_variants } = args

            // Normalisation des arguments
            if (variant_value && !selected_variants) {
                console.log(`⚠️ Legacy variant_value used: "${variant_value}"`)
            }

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

            let foundVariantName = null

            // 1. Chercher image spécifique si variantes
            if (product.variants && (selected_variants || variant_value)) {
                for (const variant of product.variants) {
                    let targetValue = null

                    if (selected_variants) {
                        const entry = Object.entries(selected_variants).find(([k]) => k.toLowerCase() === variant.name.toLowerCase())
                        if (entry) targetValue = entry[1]
                    }
                    if (!targetValue && variant_value) targetValue = variant_value

                    if (targetValue) {
                        const validOption = findMatchingOption(variant, targetValue)
                        if (validOption && typeof validOption === 'object' && validOption.image) {
                            imageUrl = validOption.image
                            foundVariantName = getOptionValue(validOption)
                            console.log(`✅ Image variante trouvée pour "${variant.name}": ${foundVariantName}`)
                            break
                        }
                    }
                }
            }

            if (!imageUrl) {
                return JSON.stringify({ success: false, error: `Pas d'image pour "${product.name}".` })
            }

            const caption = foundVariantName
                ? `Voici ${product.name} (${foundVariantName}) !`
                : `Voici ${product.name} !`

            console.log(`📸 Image à envoyer: ${product.name} ${foundVariantName ? `(${foundVariantName})` : ''}`)

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
    // CREATE BOOKING (Services: Hôtel, Restaurant, Salon, Consulting...)
    // ═══════════════════════════════════════════════════════════
    if (toolCall.function.name === 'create_booking') {
        try {
            console.log('🛠️ Executing tool: create_booking')
            const args = JSON.parse(toolCall.function.arguments)
            const {
                booking_type,
                service_name,
                selected_variant,      // v2.31: Pour chambres, menus, etc.
                selected_supplements,  // v2.31: Petit déjeuner, deuxième lit, etc.
                customer_phone,
                customer_name,
                preferred_date,
                preferred_time,
                end_date,
                party_size,
                notes
            } = args

            console.log(`🏨 create_booking: service="${service_name}", variant="${selected_variant}"`)

            const { data: agent } = await supabase
                .from('agents')
                .select('user_id, escalation_phone')
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

            // v2.31: Calculer le prix basé sur la variante sélectionnée
            let finalPrice = service.price_fcfa || 0
            let variantDetails = null

            if (selected_variant && service.variants && service.variants.length > 0) {
                // Chercher la variante dans les variantes FIXED (type de chambre, menu, etc.)
                for (const variant of service.variants) {
                    if (variant.type === 'fixed' && variant.options) {
                        const matchedOption = findMatchingOption(variant, selected_variant)
                        if (matchedOption) {
                            const optPrice = (typeof matchedOption === 'object') ? (matchedOption.price || 0) : 0
                            if (optPrice > 0) {
                                finalPrice = optPrice
                                variantDetails = {
                                    name: variant.name,
                                    value: (typeof matchedOption === 'object') ? (matchedOption.value || matchedOption.name) : matchedOption
                                }
                                console.log(`✅ Variante trouvée: ${variantDetails.name}=${variantDetails.value} @ ${finalPrice} FCFA`)
                            }
                            break
                        }
                    }
                }
            }

            // v2.31: Calculer les suppléments additifs
            let supplementsTotal = 0
            let supplementsList = []
            if (selected_supplements && service.variants) {
                for (const variant of service.variants) {
                    if (variant.type === 'additive' && variant.options) {
                        for (const opt of variant.options) {
                            const optName = (typeof opt === 'object') ? (opt.value || opt.name) : opt
                            const optPrice = (typeof opt === 'object') ? (opt.price || 0) : 0
                            // Vérifier si ce supplément est sélectionné
                            if (selected_supplements[optName] === true) {
                                supplementsTotal += optPrice
                                supplementsList.push({ name: optName, price: optPrice })
                                console.log(`➕ Supplément: ${optName} +${optPrice} FCFA`)
                            }
                        }
                    }
                }
            }

            finalPrice += supplementsTotal

            // Calculer start_time (obligatoire dans le schéma)
            const start_time = preferred_date && preferred_time
                ? new Date(`${preferred_date}T${preferred_time}:00`).toISOString()
                : new Date(`${preferred_date}T09:00:00`).toISOString()

            const { data: booking, error } = await supabase
                .from('bookings')
                .insert({
                    user_id: agent.user_id,
                    agent_id: agentId,
                    booking_type: booking_type || 'slot',
                    start_time: start_time,
                    customer_phone: normalizePhoneNumber(customer_phone),
                    customer_name: customer_name || null,
                    service_name: service.name,
                    service_id: service.id,
                    selected_variant: variantDetails ? JSON.stringify(variantDetails) : null,
                    selected_supplements: supplementsList.length > 0 ? JSON.stringify(supplementsList) : null,
                    price_fcfa: finalPrice,
                    preferred_date: preferred_date || null,
                    preferred_time: preferred_time || null,
                    end_date: end_date || null,  // Pour STAY/RENTAL
                    party_size: party_size || 1,
                    notes: notes || null,
                    status: 'confirmed',
                    conversation_id: conversationId
                })
                .select()
                .single()

            if (error) throw error

            // Message de confirmation adapté au type de service
            let confirmMsg = `📅 Réservation confirmée ! ${service.name} le ${preferred_date}`
            if (preferred_time) confirmMsg += ` à ${preferred_time}`
            if (end_date) confirmMsg += ` jusqu'au ${end_date}`
            if (party_size && party_size > 1) confirmMsg += ` pour ${party_size} personne(s)`
            confirmMsg += '.'

            // v2.33: Ajout du numéro d'escalade si disponible
            if (agent.escalation_phone) {
                confirmMsg += `\n\n📞 En cas de besoin, contactez le service client au ${agent.escalation_phone}.`
            }

            return JSON.stringify({
                success: true,
                booking_id: booking.id,
                booking_type: booking_type,
                service_name: service.name,
                date: preferred_date,
                time: preferred_time,
                end_date: end_date,
                party_size: party_size,
                price_fcfa: service.price_fcfa,
                message: confirmMsg
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
    getOptionPrice,
    productHasRealVariants,
    checkStock
}
