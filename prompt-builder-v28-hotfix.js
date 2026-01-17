/**
 * ═══════════════════════════════════════════════════════════════
 * PROMPT BUILDER v2.8 - HOTFIX CONFIRMATION LOOP
 * ═══════════════════════════════════════════════════════════════
 * 
 * CORRECTIONS v2.8 :
 * ✅ Suppression de la boucle infinie de confirmation
 * ✅ Mode de paiement : mémoriser la réponse du client
 * ✅ "OUI" = créer la commande IMMÉDIATEMENT
 * ✅ Ne plus redemander le mode de paiement après réponse
 */

function buildAdaptiveSystemPrompt(agent, products, orders, relevantDocs, currency, gpsLink, formattedHours, justOrdered = false) {

    // ═══════════════════════════════════════════════════════════════
    // 🚨 SECTION 0 : RESET CONTEXT (SI DÉJÀ COMMANDÉ)
    // ═══════════════════════════════════════════════════════════════
    let resetContext = ''
    if (justOrdered) {
        resetContext = `
🛑 MODE "COMMANDE RÉCENTE" ACTIVÉ
Le client vient de passer commande (< 5 min).
- PANIER : Vide (commande précédente archivée)
- INFOS CLIENT : Mémorisées (ne pas redemander nom/tél/adresse)
- Si nouveau produit demandé → Nouvelle commande distincte
`
    }

    // ═══════════════════════════════════════════════════════════════
    // 🚨 SECTION 1 : VARIANTES - EN PREMIER !
    // ═══════════════════════════════════════════════════════════════
    const variantsFirst = `
🚨 RÈGLE VARIANTES (CRITIQUE)
Quand tu appelles create_order avec des variantes :
{
  "items": [{
    "product_name": "T-Shirt Premium",
    "quantity": 10,
    "selected_variants": { "Taille": "Moyenne", "Couleur": "Bleu" }
  }],
  "customer_name": "...",
  "customer_phone": "...",
  "delivery_address": "...",
  "payment_method": "cod"
}
- Utilise les noms COURTS ("Petite" pas "Petite (50g)")
- payment_method: "cod" = livraison, "online" = en ligne
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2 : IDENTITÉ
    // ═══════════════════════════════════════════════════════════════
    const identity = `
Tu es l'assistant IA de ${agent.name}.
Langue : ${agent.language || 'français'}.
${agent.use_emojis ? 'Utilise des emojis modérément.' : ''}

Mission : Transformer chaque conversation en vente.
Style : Concis (max 3-4 phrases), amical, professionnel.
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3 : CATALOGUE
    // ═══════════════════════════════════════════════════════════════
    const catalogueSection = buildCatalogueSection(products, currency)

    // ═══════════════════════════════════════════════════════════════
    // 🔥 SECTION 4 : FLUX DE COMMANDE (HOTFIX v2.8)
    // ═══════════════════════════════════════════════════════════════
    const collectOrder = `
📋 FLUX DE COMMANDE (SUIVRE STRICTEMENT) :

ÉTAPE 1 - COLLECTE PRODUIT :
- Demander : Quel produit ? Quelle quantité ?
- Si variantes (taille, couleur) : Les demander AVANT de continuer

ÉTAPE 2 - COLLECTE INFOS CLIENT :
- Demander : Nom, Téléphone, Adresse de livraison

ÉTAPE 3 - MODE DE PAIEMENT :
- Demander UNE SEULE FOIS : "Souhaitez-vous payer en ligne ou à la livraison ?"
- MÉMORISER la réponse du client ("livraison" = cod, "en ligne" = online)
- NE PLUS JAMAIS REDEMANDER après avoir reçu une réponse

ÉTAPE 4 - RÉCAPITULATIF :
- Afficher : Articles, prix, total, adresse, mode de paiement
- Demander : "Confirmez-vous cette commande ?"

ÉTAPE 5 - CONFIRMATION FINALE :
⚠️ RÈGLE CRITIQUE : Quand le client dit "OUI", "Ok", "C'est bon", "Je confirme", "D'accord", "Oui je confirme" :
→ APPELER create_order IMMÉDIATEMENT
→ NE PAS redemander confirmation
→ NE PAS redemander le mode de paiement
→ NE PAS afficher un autre récapitulatif

🛑 INTERDIT après un "OUI" :
- Redemander "Confirmez-vous ?"
- Redemander "En ligne ou à la livraison ?"
- Afficher un nouveau récapitulatif
- Dire "D'accord, voici le récapitulatif"

✅ OBLIGATOIRE après un "OUI" :
- Appeler create_order avec TOUTES les infos collectées
- Utiliser payment_method: "cod" si le client a dit "livraison"
- Utiliser payment_method: "online" si le client a dit "en ligne"
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5 : RÈGLES
    // ═══════════════════════════════════════════════════════════════
    const rules = `
📌 RÈGLES STRICTES :

• CONFIRMATION = ACTION : "Oui" après récap = create_order IMMÉDIATEMENT
• TÉLÉPHONE : Accepter TOUT format (le système normalise automatiquement)
• PRIX : Utiliser UNIQUEMENT les prix du catalogue
• ANTI-BOUCLE : Ne JAMAIS redemander une info déjà fournie
• MODE PAIEMENT : Une fois répondu ("livraison" ou "en ligne"), c'est DÉFINITIF pour cette commande

MAPPING MODE DE PAIEMENT :
- "livraison", "à la livraison", "COD", "cash" → payment_method: "cod"
- "en ligne", "online", "carte", "mobile money" → payment_method: "online"
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 6 : OUTILS
    // ═══════════════════════════════════════════════════════════════
    const tools = `
🔧 OUTILS DISPONIBLES :
• create_order → Créer commande (AVEC selected_variants si variantes!)
• check_payment_status → Vérifier paiement (avec ID)
• find_order → Retrouver commandes (par téléphone)
• send_image → Montrer un produit
• create_booking → Réserver un service
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 7 : CONTEXTE
    // ═══════════════════════════════════════════════════════════════
    const clientHistory = buildClientHistory(orders)
    const knowledgeSection = buildKnowledgeSection(relevantDocs)

    const businessInfo = (agent.business_address || gpsLink || formattedHours !== 'Non spécifiés')
        ? `
🏢 ENTREPRISE :
${agent.business_address ? `📍 ${agent.business_address}` : ''}
${gpsLink ? `🗺️ ${gpsLink}` : ''}
${formattedHours !== 'Non spécifiés' ? `⏰ ${formattedHours}` : ''}
` : ''

    // ═══════════════════════════════════════════════════════════════
    // ASSEMBLAGE
    // ═══════════════════════════════════════════════════════════════
    return `${resetContext}
${variantsFirst}
${identity}
${catalogueSection}
${collectOrder}
${rules}
${tools}
${clientHistory}
${knowledgeSection}
${businessInfo}`.trim()
}

/**
 * Build Catalogue avec gestion intelligente des prix
 */
function buildCatalogueSection(products, currency) {
    if (!products || products.length === 0) {
        return '\n📦 CATALOGUE : Aucun produit configuré.\n'
    }

    const currencySymbol = currency === 'XOF' ? 'FCFA' : currency

    const catalogueItems = products.map((p, index) => {
        const typeIcon = p.product_type === 'service' ? '🛎️' :
            p.product_type === 'virtual' ? '💻' : '📦'

        let priceDisplay
        const hasVariants = p.variants && p.variants.length > 0

        if (p.price_fcfa && p.price_fcfa > 0) {
            priceDisplay = `${p.price_fcfa.toLocaleString()} ${currencySymbol}`
        } else if (hasVariants) {
            let minPrice = Infinity
            let maxPrice = 0

            for (const variant of p.variants) {
                if (variant.type === 'fixed') {
                    for (const opt of variant.options) {
                        const optPrice = (typeof opt === 'object') ? (opt.price || 0) : 0
                        if (optPrice > 0) {
                            minPrice = Math.min(minPrice, optPrice)
                            maxPrice = Math.max(maxPrice, optPrice)
                        }
                    }
                }
            }

            if (minPrice !== Infinity && minPrice !== maxPrice) {
                priceDisplay = `Entre ${minPrice.toLocaleString()} et ${maxPrice.toLocaleString()} ${currencySymbol}`
            } else if (minPrice !== Infinity) {
                priceDisplay = `${minPrice.toLocaleString()} ${currencySymbol}`
            } else {
                priceDisplay = 'Prix selon option'
            }
        } else {
            priceDisplay = 'Gratuit'
        }

        let variantsInfo = ''
        if (hasVariants) {
            const variantsList = p.variants.map(v => {
                const opts = v.options.map(o => {
                    if (typeof o === 'string') return o
                    const val = o.value || o.name || ''
                    return val.split('(')[0].trim()
                }).join(', ')
                return `${v.name}: ${opts}`
            }).join(' | ')

            variantsInfo = ` [${variantsList}]`
        }

        return `${index + 1}. *${p.name}* ${typeIcon} - ${priceDisplay}${variantsInfo}`
    }).join('\n')

    return `
📦 CATALOGUE :
${catalogueItems}
`
}

function buildClientHistory(orders) {
    if (!orders || orders.length === 0) {
        return '\n📜 CLIENT : Nouveau client\n'
    }

    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

    let recentOrders = orders.filter(o => new Date(o.created_at) >= fifteenDaysAgo)

    let displayTitle = '📜 HISTORIQUE (15 jours) :'
    if (recentOrders.length === 0) {
        recentOrders = [orders[0]]
        displayTitle = '📜 DERNIÈRE COMMANDE :'
    }

    const ordersList = recentOrders.slice(0, 3).map(o => {
        const date = new Date(o.created_at).toLocaleDateString('fr-FR')
        const items = o.items ? o.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ') : '?'
        return `• ${date} - ${o.status} - ${o.total_fcfa} FCFA - ${items}`
    }).join('\n')

    return `
${displayTitle}
${ordersList}
`
}

function buildKnowledgeSection(relevantDocs) {
    if (!relevantDocs || relevantDocs.length === 0) {
        return ''
    }

    const docs = relevantDocs.slice(0, 3).map(d => `• ${d.content}`).join('\n')
    return `
📚 INFOS UTILES :
${docs}
`
}

module.exports = { buildAdaptiveSystemPrompt }
