
const { normalizePhoneNumber, checkStock, productHasRealVariants, findMatchingOption, getOptionValue, getOptionPrice } = require('./tool-helpers')

// ═══════════════════════════════════════════════════════════
// CREATE ORDER
// ═══════════════════════════════════════════════════════════
async function handleCreateOrder(args, agentId, products, conversationId, supabase) {
    try {
        console.log('🛠️ Executing tool: create_order')
        const { items, customer_name, customer_phone, delivery_address, email, payment_method, notes } = args

        let finalNotes = notes || ''
        if (email) finalNotes += `\n📧 Email: ${email}`

        const { data: agent } = await supabase
            .from('agents')
            .select('user_id, payment_mode, mobile_money_orange, mobile_money_mtn, mobile_money_wave, custom_payment_methods, escalation_phone')
            .eq('id', agentId)
            .single()

        if (!agent) throw new Error('Agent not found')

        // Validation Email pour Digital
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

        for (const item of items) {
            console.log(`\n📦 Traitement: "${item.product_name}" x${item.quantity}`)

            // Scoring Search
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
                return JSON.stringify({
                    success: false,
                    error: `Produit "${item.product_name}" non trouvé. Disponibles: ${products.map(p => p.name).join(', ')}`
                })
            }

            // Check Stock
            const stockCheck = checkStock(product, item.quantity)
            if (!stockCheck.ok) {
                return JSON.stringify({
                    success: false,
                    error: `Stock insuffisant pour "${product.name}". ${stockCheck.available > 0 ? `Seulement ${stockCheck.available} disponible(s).` : 'Produit épuisé.'}`,
                    available_stock: stockCheck.available,
                    hint: stockCheck.available > 0 ? `Proposez ${stockCheck.available} unités ou un produit alternatif.` : 'Proposez un produit alternatif.'
                })
            }

            // Price & Variants (Refactored v4.1)
            const { calculateItemPrice } = require('./pricing-logic')

            const pricingResult = calculateItemPrice(product, item.selected_variants, item.product_name)

            // Log des étapes de calcul (debug)
            if (pricingResult.logs) pricingResult.logs.forEach(l => console.log(`      ${l}`))

            if (pricingResult.error) {
                return JSON.stringify({
                    success: false,
                    error: pricingResult.error,
                    hint: 'Utilisez selected_variants.'
                })
            }

            let price = pricingResult.price
            let matchedVariantOption = pricingResult.variantOptionName

            total += price * item.quantity
            orderItems.push({
                product_name: matchedVariantOption ? `${product.name} (${matchedVariantOption})` : product.name,
                product_description: product.description,
                quantity: item.quantity,
                unit_price_fcfa: price
            })
        }

        // Create Order in DB
        const normalizedPhone = normalizePhoneNumber(customer_phone)
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

        if (orderItems.length > 0) {
            await supabase.from('order_items').insert(
                orderItems.map(i => ({ ...i, order_id: order.id }))
            )
        }

        // 🔔 NOTIFICATION: Nouvelle commande
        try {
            const { notify } = require('../../../notifications/notify')
            notify(agent.user_id, 'new_order', {
                orderNumber: order.id?.toString().slice(-8) || '',
                customerName: customer_name || 'Client',
                totalAmount: total
            })

            // Vérifier et notifier si stock épuisé après commande
            for (const item of args.items || []) {
                if (item.product_id) {
                    const { data: prod } = await supabase
                        .from('products')
                        .select('stock_quantity, name')
                        .eq('id', item.product_id)
                        .single()

                    if (prod && prod.stock_quantity !== -1 && prod.stock_quantity !== null) {
                        const newStock = prod.stock_quantity - (item.quantity || 1)
                        // Update stock
                        await supabase.from('products').update({ stock_quantity: Math.max(0, newStock) }).eq('id', item.product_id)
                        // Notify if stock out
                        if (newStock <= 0) {
                            notify(agent.user_id, 'stock_out', { productName: prod.name })
                        }
                    }
                }
            }
        } catch (notifError) {
            console.error('🔔 Notification error (non-blocking):', notifError)
        }

        // Génération du résumé GROUPÉ (pour l'affichage Clean)
        // Génération du résumé GROUPÉ et DÉTAILLÉ (Format v5: Qty X Unit = Total)
        const groupedSummary = {}

        // On itère sur orderItems pour avoir les prix validés
        orderItems.forEach(item => {
            // Retrouver le Nom produit de base (sans variantes)
            // item.product_name est "T-Shirt (Rouge)" ou juste "T-Shirt"

            let baseName = item.product_name
            let variantDetail = 'Standard'

            if (baseName.includes('(')) {
                const part = baseName.split('(')
                baseName = part[0].trim()
                // Retirer la dernière parenthèse fermante
                variantDetail = part[1].substring(0, part[1].length - 1).trim()
            }

            if (!groupedSummary[baseName]) groupedSummary[baseName] = { lines: [], subTotal: 0 }

            const lineTotal = item.quantity * item.unit_price_fcfa
            groupedSummary[baseName].subTotal += lineTotal

            // Format: "- Rouge 2 X 15,000 = 30,000 FCFA"
            // Ou "- Standard 2 X 15,000 = 30,000 FCFA"
            const lineStr = `- ${variantDetail} ${item.quantity} X ${item.unit_price_fcfa.toLocaleString('fr-FR')} = ${lineTotal.toLocaleString('fr-FR')} FCFA`
            groupedSummary[baseName].lines.push(lineStr)
        })

        const itemsSummary = Object.entries(groupedSummary).map(([name, data]) => {
            return `*${name}* :\n${data.lines.join('\n')}\nSous-total = ${data.subTotal.toLocaleString('fr-FR')} FCFA`
        }).join('\n\n')
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

        if (payment_method === 'cod') {
            let msg = `✅ Commande confirmée ! Nous préparons la livraison. 🚚\nPaiement de ${total} FCFA à prévoir à la livraison.`
            if (agent.escalation_phone) msg += `\n\n📞 En cas de besoin, contactez le service client au ${agent.escalation_phone}.`
            return JSON.stringify({ success: true, order_id: order.id, payment_method: 'cod', items: itemsSummary, message: msg })
        }

        if (agent.payment_mode === 'mobile_money_direct') {
            const paymentMethods = []
            if (agent.mobile_money_orange) paymentMethods.push({ type: 'Orange Money', number: agent.mobile_money_orange })
            if (agent.mobile_money_mtn) paymentMethods.push({ type: 'MTN Money', number: agent.mobile_money_mtn })
            if (agent.mobile_money_wave) paymentMethods.push({ type: 'Wave', number: agent.mobile_money_wave })

            let msg = `✅ Commande enregistrée en attente de paiement. Veuillez effectuer le transfert de ${total} FCFA.`
            if (agent.escalation_phone) msg += `\n\n📞 En cas de besoin, contactez le service client au ${agent.escalation_phone}.`
            return JSON.stringify({
                success: true, order_id: order.id, total: total, payment_method: 'mobile_money_direct',
                payment_methods: paymentMethods, items: itemsSummary, message: msg
            })
        }

        // CinetPay
        let msg = `✅ Commande créée ! Lien de paiement généré pour ${total} FCFA.`
        if (agent.escalation_phone) msg += `\n\n📞 En cas de besoin, contactez le service client au ${agent.escalation_phone}.`
        return JSON.stringify({
            success: true, order_id: order.id, total: total, payment_method: 'online',
            payment_link: `${appUrl}/pay/${order.id}`, items: itemsSummary, message: msg
        })

    } catch (error) {
        console.error('❌ Create Order Error:', error)
        return JSON.stringify({ success: false, error: error.message || 'Erreur lors de la création de la commande' })
    }
}

// ═══════════════════════════════════════════════════════════
// CHECK PAYMENT STATUS
// ═══════════════════════════════════════════════════════════
async function handleCheckPaymentStatus(args, supabase) {
    try {
        console.log('🛠️ Executing tool: check_payment_status')
        const { order_id } = args

        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order_id)
            .single()

        if (error || !order) return JSON.stringify({ success: false, error: `Commande ${order_id} introuvable.` })

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
// FIND ORDER
// ═══════════════════════════════════════════════════════════
async function handleFindOrder(args, agentId, supabase) {
    try {
        console.log('🛠️ Executing tool: find_order')
        const { phone_number } = args
        const normalizedPhone = normalizePhoneNumber(phone_number)

        if (!normalizedPhone) return JSON.stringify({ success: false, error: 'Numéro invalide' })

        // 1. Récupérer les 3 dernières commandes
        const { data: orders } = await supabase
            .from('orders')
            .select('id, total_fcfa, status, created_at, items:order_items(product_name, quantity)')
            .eq('customer_phone', normalizedPhone)
            .order('created_at', { ascending: false })
            .limit(3)

        if (!orders || orders.length === 0) return JSON.stringify({ success: true, message: 'Aucune commande trouvée pour ce numéro.' })

        // 2. Formater la liste
        const ordersList = orders.map(o => {
            const date = new Date(o.created_at).toLocaleDateString('fr-FR')
            const items = o.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')
            return `- Commande #${o.id.substring(0, 8)} du ${date} (${o.total_fcfa} FCFA) : ${o.status}\n  Articles: ${items}`
        }).join('\n\n')

        // 3. Récupérer le numéro d'escalade de l'agent
        const { data: agent } = await supabase
            .from('agents')
            .select('escalation_phone')
            .eq('id', agentId)
            .single()

        // 4. Construire le message final avec la mention SAV
        let finalMessage = `Voici les dernières commandes trouvées :\n${ordersList}`

        finalMessage += `\n\nℹ️ Ceci sont vos 3 dernières commandes.`

        if (agent && agent.escalation_phone) {
            finalMessage += ` Pour tout historique plus ancien, veuillez contacter le service client au ${agent.escalation_phone}.`
        } else {
            finalMessage += ` Pour tout historique plus ancien, veuillez contacter le service client.`
        }

        return JSON.stringify({ success: true, message: finalMessage })
    } catch (error) {
        console.error('❌ Find Order Error:', error)
        return JSON.stringify({ success: false, error: 'Erreur lors de la recherche.' })
    }
}

module.exports = { handleCreateOrder, handleCheckPaymentStatus, handleFindOrder }
