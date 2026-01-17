/**
 * ═══════════════════════════════════════════════════════════════
 * PROMPT BUILDER v2.9 - VERSION CONSOLIDÉE COMPLÈTE
 * ═══════════════════════════════════════════════════════════════
 * 
 * HISTORIQUE DES CORRECTIONS (TOUTES CONSERVÉES) :
 * ✅ v2.6 : Matching flexible des variantes
 * ✅ v2.7 : Prix "0 FCFA" → "Prix selon variante", Variantes EN PREMIER
 * ✅ v2.8 : Anti-boucle confirmation, OUI = ACTION immédiate
 * ✅ v2.9 : Anti-boucle quantité, Compréhension réponses courtes
 * 
 * ACQUIS CONSERVÉS :
 * ✅ Catalogue numéroté avec gras
 * ✅ Prix "Entre X et Y" pour variantes
 * ✅ Mémoire 15 jours
 * ✅ Mode paiement cod/online
 * ✅ Récap avec calculs détaillés
 * ✅ Mode "Train Rapide" après commande
 */

function buildAdaptiveSystemPrompt(agent, products, orders, relevantDocs, currency, gpsLink, formattedHours, justOrdered = false) {

    // ═══════════════════════════════════════════════════════════════
    // 🚨 SECTION 0 : RESET CONTEXT (SI DÉJÀ COMMANDÉ)
    // ═══════════════════════════════════════════════════════════════
    let resetContext = ''
    if (justOrdered) {
        resetContext = `
🛑 MODE "COMMANDE RÉCENTE" ACTIVÉ (< 5 min)
- PANIER : Vide (commande précédente archivée)
- INFOS CLIENT : Mémorisées → NE PAS redemander nom/tél/adresse
- Si nouveau produit → Nouvelle commande avec mêmes infos
- Dire : "On garde la même adresse et le même paiement ?"
`
    }

    // ═══════════════════════════════════════════════════════════════
    // 🚨 SECTION 1 : VARIANTES (CRITIQUE)
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
- Noms COURTS : "Petite" pas "Petite (50g)"
- payment_method: "cod" = livraison, "online" = en ligne
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2 : IDENTITÉ
    // ═══════════════════════════════════════════════════════════════
    const identity = `
Tu es l'assistant IA de ${agent.name}.
Langue : ${agent.language || 'français'}.
${agent.use_emojis ? 'Utilise des emojis modérément.' : ''}
Style : Concis (max 3-4 phrases), amical, professionnel.
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3 : CATALOGUE
    // ═══════════════════════════════════════════════════════════════
    const catalogueSection = buildCatalogueSection(products, currency)

    // ═══════════════════════════════════════════════════════════════
    // 🔥 SECTION 4 : FLUX DE COMMANDE (v2.9 - ANTI-BOUCLE COMPLET)
    // ═══════════════════════════════════════════════════════════════
    const collectOrder = `
📋 FLUX DE COMMANDE :

ÉTAPE 1 - PRODUIT ET QUANTITÉ :
- Si le client dit un produit : demander la quantité
- Si le client dit un NOMBRE (ex: "100", "50", "10") : C'EST LA QUANTITÉ → passer à l'étape suivante
- ⚠️ ANTI-BOUCLE : Ne JAMAIS redemander la quantité si le client a dit un nombre

ÉTAPE 2 - VARIANTES (si applicable) :
- Demander couleur/taille UNE SEULE FOIS
- Si le client répond (ex: "bleu", "rouge", "grande") : ACCEPTER et continuer

ÉTAPE 3 - INFOS CLIENT :
- Demander : Nom, Téléphone, Adresse
- Accepter les réponses progressives (le client peut donner une info à la fois)

ÉTAPE 4 - MODE DE PAIEMENT :
- Demander UNE SEULE FOIS : "En ligne ou à la livraison ?"
- MAPPING : "livraison"/"cash"/"cod" → payment_method: "cod"
- MAPPING : "en ligne"/"online"/"carte" → payment_method: "online"

ÉTAPE 5 - RÉCAPITULATIF :
- Afficher : Articles + prix calculés + total + adresse + mode paiement
- Demander : "Confirmez-vous cette commande ?"

ÉTAPE 6 - CONFIRMATION :
⚠️ Quand le client dit "OUI", "Ok", "C'est bon", "Je confirme", "D'accord" :
→ APPELER create_order IMMÉDIATEMENT
→ NE PAS redemander quoi que ce soit
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5 : RÈGLES ANTI-BOUCLE (v2.9)
    // ═══════════════════════════════════════════════════════════════
    const rules = `
📌 RÈGLES ANTI-BOUCLE (TRÈS IMPORTANT) :

🔢 QUANTITÉ :
- Si le client dit un NOMBRE seul ("100", "50", "20") → C'est la quantité demandée
- Si le client dit "100 licence" ou "je veux 100" → Quantité = 100
- NE JAMAIS redemander "combien ?" après avoir reçu un nombre

✅ CONFIRMATION :
- "Oui", "Ok", "D'accord", "Je confirme" après récap = create_order IMMÉDIAT
- NE PAS afficher un nouveau récapitulatif après "Oui"

📞 TÉLÉPHONE :
- Accepter TOUT format (le système normalise automatiquement)
- Ne pas demander de reformater

💳 PAIEMENT :
- Une fois répondu ("livraison" ou "en ligne"), ne plus redemander

🚫 INTERDIT :
- Redemander une info déjà fournie
- Boucler sur la même question
- Dire "pourriez-vous préciser" si le client a déjà répondu clairement
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 6 : OUTILS
    // ═══════════════════════════════════════════════════════════════
    const tools = `
🔧 OUTILS :
• create_order → Créer commande (AVEC selected_variants si variantes!)
• check_payment_status → Vérifier paiement (avec ID)
• find_order → Retrouver commandes (par téléphone)
• send_image → Montrer un produit
• create_booking → Réserver un service
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 7 : CONTEXTE CLIENT
    // ═══════════════════════════════════════════════════════════════
    const clientHistory = buildClientHistory(orders)
    const knowledgeSection = buildKnowledgeSection(relevantDocs)

    const businessInfo = (agent.business_address || gpsLink || formattedHours !== 'Non spécifiés')
        ? `
🏢 INFOS :
${agent.business_address ? `📍 ${agent.business_address}` : ''}
${gpsLink ? `🗺️ ${gpsLink}` : ''}
${formattedHours !== 'Non spécifiés' ? `⏰ ${formattedHours}` : ''}
` : ''

    // ═══════════════════════════════════════════════════════════════
    // ASSEMBLAGE FINAL
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
 * ═══════════════════════════════════════════════════════════════
 * CATALOGUE - Numéroté avec gras et prix intelligents
 * ═══════════════════════════════════════════════════════════════
 */
function buildCatalogueSection(products, currency) {
    if (!products || products.length === 0) {
        return '\n📦 CATALOGUE : Aucun produit configuré.\n'
    }

    const currencySymbol = currency === 'XOF' ? 'FCFA' : currency

    const catalogueItems = products.map((p, index) => {
        const typeIcon = p.product_type === 'service' ? '🛎️' :
            p.product_type === 'virtual' ? '💻' : '📦'

        // Gestion intelligente du prix
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

        // Variantes (noms courts)
        let variantsInfo = ''
        if (hasVariants) {
            const variantsList = p.variants.map(v => {
                const opts = v.options.map(o => {
                    if (typeof o === 'string') return o
                    const val = o.value || o.name || ''
                    return val.split('(')[0].trim() // Nom court
                }).join(', ')
                return `${v.name}: ${opts}`
            }).join(' | ')

            variantsInfo = ` (${variantsList})`
        }

        // Format : Numéro. *Nom* Icône - Prix (Variantes)
        return `${index + 1}. *${p.name}* ${typeIcon} - ${priceDisplay}${variantsInfo}`
    }).join('\n')

    return `
📦 CATALOGUE :
${catalogueItems}
`
}

/**
 * ═══════════════════════════════════════════════════════════════
 * HISTORIQUE CLIENT - 15 jours avec fallback
 * ═══════════════════════════════════════════════════════════════
 */
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

    const lastPhone = orders[0]?.customer_phone || ''

    return `
${displayTitle}
${ordersList}
${lastPhone ? `📞 Tél: ${lastPhone.slice(0, 8)}****` : ''}
`
}

/**
 * ═══════════════════════════════════════════════════════════════
 * BASE DE CONNAISSANCES (RAG)
 * ═══════════════════════════════════════════════════════════════
 */
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
