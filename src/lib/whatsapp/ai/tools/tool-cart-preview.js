
/**
 * ═══════════════════════════════════════════════════════════════
 * TOOL : preview_cart (mode lead_only uniquement)
 * Calcule un récapitulatif chiffré fiable à partir des prix réels
 * du catalogue — réutilise calculateItemPrice, la même logique de
 * tarification que create_order, pour garantir un total exact sans
 * dépendre du calcul mental du modèle.
 * ═══════════════════════════════════════════════════════════════
 */

const { calculateItemPrice } = require('./pricing-logic')

function findProductByName(products, productName) {
    const searchName = productName.toLowerCase()
    const searchTerms = searchName.split(' ').filter(w => w.length > 2)
    let bestProduct = null
    let bestScore = 0

    for (const p of products) {
        const productNameLower = p.name.toLowerCase()
        let score = 0
        if (productNameLower === searchName) score = 100
        else if (searchName.includes(productNameLower) || productNameLower.includes(searchName)) score = 50
        else score = searchTerms.filter(term => productNameLower.includes(term)).length * 10

        if (score > bestScore) {
            bestScore = score
            bestProduct = p
        }
    }

    return bestScore >= 10 ? bestProduct : null
}

// Persiste le dernier panier calculé dans conversation.metadata.lead_cart — permet à
// capture_lead (appelé plus tard, potentiellement plusieurs tours après) de récupérer
// un total/detail garanti exact, sans dépendre de l'IA pour le retransmettre fidèlement.
async function persistLeadCart(conversationId, supabase, cartSnapshot) {
    if (!conversationId || !supabase) return
    try {
        const { data: conversation, error: fetchErr } = await supabase
            .from('conversations')
            .select('metadata')
            .eq('id', conversationId)
            .single()
        if (fetchErr || !conversation) return

        const mergedMetadata = { ...(conversation.metadata || {}), lead_cart: cartSnapshot }
        await supabase.from('conversations').update({ metadata: mergedMetadata }).eq('id', conversationId)
    } catch (err) {
        console.error('preview_cart: échec persistance lead_cart (non bloquant)', err?.message || err)
    }
}

async function handlePreviewCart(args, products, conversationId, supabase) {
    try {
        console.log('🛠️ Executing tool: preview_cart')
        const { items, delivery_fee } = args || {}

        if (!Array.isArray(items) || items.length === 0) {
            return JSON.stringify({
                success: false,
                error: 'AUCUN ARTICLE. Fournis au moins un article avec product_name et quantity.'
            })
        }

        const lines = []
        const structuredItems = []
        let total = 0

        for (const item of items) {
            if (!item || !item.product_name || !item.quantity || item.quantity < 1) {
                return JSON.stringify({
                    success: false,
                    error: 'ARTICLE INVALIDE. Chaque article nécessite product_name et quantity (>= 1). N\'invente jamais une quantité manquante.'
                })
            }

            const product = findProductByName(products, item.product_name)
            if (!product) {
                return JSON.stringify({
                    success: false,
                    error: `Produit "${item.product_name}" non trouvé. Disponibles: ${products.map(p => p.name).join(', ')}`
                })
            }

            const pricingResult = calculateItemPrice(product, item.selected_variants, item.product_name, item.quantity)
            if (pricingResult.error) {
                return JSON.stringify({
                    success: false,
                    error: pricingResult.error,
                    hint: 'Précise la/les variante(s) manquante(s) via selected_variants avant de rappeler ce tool.'
                })
            }

            const unitPrice = pricingResult.price
            const subtotal = unitPrice * item.quantity
            total += subtotal

            const label = pricingResult.variantOptionName
                ? `${product.name} ${pricingResult.variantOptionName}`
                : product.name

            lines.push(`*• ${item.quantity} ${label} 💰 ${unitPrice.toLocaleString('fr-FR')} FCFA × ${item.quantity} = ${subtotal.toLocaleString('fr-FR')} FCFA*`)
            structuredItems.push({
                product_name: product.name,
                variant: pricingResult.variantOptionName || null,
                quantity: item.quantity,
                unit_price: unitPrice,
                subtotal,
            })
        }

        const deliveryFee = (typeof delivery_fee === 'number' && delivery_fee > 0) ? delivery_fee : null
        if (deliveryFee) {
            lines.push(`*Frais de livraison : ${deliveryFee.toLocaleString('fr-FR')} FCFA*`)
            total += deliveryFee
        }

        const recapText = `Voici votre commande :\n${lines.join('\n')}\n*TOTAL : ${total.toLocaleString('fr-FR')} FCFA*`

        await persistLeadCart(conversationId, supabase, {
            items: structuredItems,
            total,
            deliveryFee,
            updatedAt: new Date().toISOString(),
        })

        return JSON.stringify({
            success: true,
            total,
            recap_text: recapText
        })
    } catch (err) {
        console.error('preview_cart: erreur inattendue', err)
        return JSON.stringify({ success: false, error: 'Erreur interne calcul panier' })
    }
}

module.exports = { handlePreviewCart }
