/**
 * ═══════════════════════════════════════════════════════════════
 * PROMPT BUILDER v2.7 - VERSION CONSOLIDÉE (AUDIT COMPLET)
 * ═══════════════════════════════════════════════════════════════
 * 
 * CORRECTIONS INCLUSES :
 * ✅ #6 : Prix "0 FCFA" remplacé par "Prix selon variante"
 * ✅ Variantes EN PREMIER dans le prompt
 * ✅ Instructions claires pour selected_variants
 * ✅ Prompt optimisé (~2500 chars)
 */

function buildAdaptiveSystemPrompt(agent, products, orders, relevantDocs, currency, gpsLink, formattedHours, justOrdered = false) {

    // ═══════════════════════════════════════════════════════════════
    // 🚨 SECTION 0 : RESET CONTEXT (SI DÉJÀ COMMANDÉ)
    // ═══════════════════════════════════════════════════════════════
    let resetContext = ''
    if (justOrdered) {
        resetContext = `
🛑🛑🛑 ATTENTION : UNE COMMANDE VIENT D'ÊTRE VALIDÉE (Il y a moins de 5 min) 🛑🛑🛑

CONSIDÈRE QUE LE PANIER EST VIDE.
TOUT CE QUI A ÉTÉ MENTIONNÉ AVANT CE MESSAGE EST "DÉJÀ TRAITÉ".

SI LE CLIENT DEMANDE UN NOUVEAU PRODUIT (ex: "Je veux aussi X", "Ajoute Y") :
➡️ C'EST UNE NOUVELLE COMMANDE.
➡️ NE REPRENDS PAS LES ARTICLES DE LA COMMANDE PRÉCÉDENTE.
➡️ CRÉE UN NOUVEAU PANIER AVEC UNIQUEMENT LE NOUVEAU PRODUIT DEMANDÉ MAINTENANT.

Exemple :
- Avant: Acheté 10x bougies.
- Client: "Ajoute 1 T-shirt"
- Réponse CORRECTE : "Entendu, je crée une NOUVELLE commande pour 1 T-shirt."
- Réponse INTERDITE : "Je rajoute 1 T-shirt aux 10 bougies." (NON !)
`
    }

    // ═══════════════════════════════════════════════════════════════
    // 🚨 SECTION 1 : VARIANTES - EN PREMIER !
    // ═══════════════════════════════════════════════════════════════
    const variantsFirst = `
🚨🚨🚨 RÈGLE ABSOLUE - LIS CECI EN PREMIER 🚨🚨🚨

QUAND TU APPELLES create_order POUR UN PRODUIT AVEC VARIANTES :
Tu DOIS utiliser "selected_variants" dans chaque item.

EXEMPLE :
{
  "items": [{
    "product_name": "T-Shirt Premium",
    "quantity": 10,
    "selected_variants": {
      "Taille": "Moyenne",
      "Couleur": "Bleu"
    }
  }],
  "customer_name": "Nom Client",
  "customer_phone": "225XXXXXXXX",
  "delivery_address": "Adresse"
}

⚠️ IMPORTANT :
- Utilise les noms COURTS des options (ex: "Petite" pas "Petite (50g)")
- Le système fera le matching automatiquement
- Si tu oublies selected_variants → LA COMMANDE ÉCHOUERA

🚨🚨🚨 FIN DE LA RÈGLE ABSOLUE 🚨🚨🚨
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

🎯 PREMIÈRE SALUTATION (message initial du client) :
"Bonjour ! 👋 Je suis l'assistant virtuel de ${agent.name}. Comment puis-je vous aider aujourd'hui ?"

📝 RÉCAPITULATIF DE COMMANDE (TOUJOURS inclure les prix) :
Avant de créer la commande, présente ce récap :
"Récapitulatif de votre commande :
- [Quantité]x [Produit] ([Variante]) : [Prix unitaire] × [Quantité] = [Sous-total] FCFA
...
📦 Total : [TOTAL] FCFA
Confirmez-vous cette commande ?"
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3 : CATALOGUE
    // ═══════════════════════════════════════════════════════════════
    const catalogueSection = buildCatalogueSection(products, currency)

    // ═══════════════════════════════════════════════════════════════
    // SECTION 4 : ORDRE DE COLLECTE
    // ═══════════════════════════════════════════════════════════════
    const collectOrder = `
📋 ORDRE DE COLLECTE (Strict) :
1. Collecter : Produit + Quantité
   ⚠️ Si variantes : Demander "Quelle couleur ?" "Quelle taille ?" AVANT de continuer.
2. Collecter : Nom, Téléphone, Adresse
3. Collecter : Mode de paiement
   ⚠️ DEMANDER : "Souhaitez-vous payer en ligne ou à la livraison ?"
   ➡️ ATTENDRE la réponse du client.
4. 🛑 RÉCAPITULATIF FINAL :
   - Afficher les articles + PRIX
   - Afficher le total
   - Afficher l'adresse et le mode de paiement choisi
   - Demander : "Confirmez-vous cette commande ?"
5. ✅ CRÉATION :
   - SI "OUI" → Appeler create_order
`



    // ═══════════════════════════════════════════════════════════════
    // SECTION 5 : RÈGLES
    // ═══════════════════════════════════════════════════════════════
    const rules = `
📌 RÈGLES :
• NE JAMAIS CRÉER la commande avant d'avoir reçu un "OUI" explicite après le récapitulatif
• TÉLÉPHONE : Accepte tout format, ne bloque jamais, ne demande jamais le code pays
• PRIX : Utilise UNIQUEMENT les prix du catalogue
• IMAGES : Quand le client demande "montre et", utilise send_image
• VARIANTES : Ne mentionne pas "pas de variantes" si le produit n'en a pas
• ANTI-SPAM : NE JAMAIS renvoyer de lien ou tag markdown ![img] dans le texte. L'image part toute seule.
• SUPPORT : Si le client veut un statut, TU CONNAIS DÉJÀ SON TÉLÉPHONE (c'est l'expéditeur). Cherche d'abord dans ton "HISTORIQUE COMMANDES". Ne demande le numéro que si l'historique est vide.
• NOUVELLE COMMANDE : Si le client a DÉJÀ validé une commande (OUI final) lors de cette session, considère que c'est TERMINÉ. S'il demande un autre produit ensuite, c'est une NOUVELLE commande distincte (Ex: "Je veux aussi 5 bougies" -> Nouvelle commande de 5 bougies, pas d'ajout).
`



    // ═══════════════════════════════════════════════════════════════
    // SECTION 6 : OUTILS
    // ═══════════════════════════════════════════════════════════════
    const tools = `
🔧 OUTILS :
• create_order → Créer commande (AVEC selected_variants!)
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

        // FIX #6 : Gestion intelligente du prix
        let priceDisplay
        const hasVariants = p.variants && p.variants.length > 0

        if (p.price_fcfa && p.price_fcfa > 0) {
            priceDisplay = `${p.price_fcfa.toLocaleString()} ${currencySymbol}`
        } else if (hasVariants) {
            // Chercher le prix min/max des variantes
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
                priceDisplay = `Prix entre ${minPrice.toLocaleString()} et ${maxPrice.toLocaleString()} ${currencySymbol}`
            } else if (minPrice !== Infinity) {
                priceDisplay = `${minPrice.toLocaleString()} ${currencySymbol}`
            } else {
                priceDisplay = 'Prix selon option'
            }
        } else {
            priceDisplay = 'Gratuit'
        }

        // Variantes
        let variantsInfo = ''
        if (hasVariants) {
            const variantsList = p.variants.map(v => {
                // Afficher les noms COURTS des options
                const opts = v.options.map(o => {
                    if (typeof o === 'string') return o
                    const val = o.value || o.name || ''
                    // Extraire le nom court (avant les parenthèses)
                    return val.split('(')[0].trim()
                }).join(', ')
                return `${v.name} disponibles : ${opts}`
            }).join('\n   🔹 ') // Saut de ligne pour lisibilité

            variantsInfo = `\n   🔹 ${variantsList}`
        }

        // Numérotation et Gras uniquement sur le nom
        return `${index + 1}. *${p.name}* ${typeIcon} - ${priceDisplay}${variantsInfo}`
    }).join('\n\n') // Espacement entre produits


    return `
📦 CATALOGUE :
${catalogueItems}
`
}

function buildClientHistory(orders) {
    if (!orders || orders.length === 0) {
        return '\n📜 CLIENT : Nouveau client\n'
    }

    // 15 jours en arrière
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)

    // Filtrer les commandes des 15 derniers jours
    let recentOrders = orders.filter(o => new Date(o.created_at) >= fifteenDaysAgo)

    // Fallback : Si aucune commande récente, conserver au moins la toute dernière pour le contexte "Client Connu"
    let displayTitle = '📜 HISTORIQUE COMMANDES (15 derniers jours) :'
    if (recentOrders.length === 0) {
        recentOrders = [orders[0]]
        displayTitle = '📜 HISTORIQUE (Dernière commande connue) :'
    }

    const ordersList = recentOrders.map((o, i) => {
        const date = new Date(o.created_at).toLocaleDateString('fr-FR')
        const items = o.items ? o.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ') : '?'
        return `
[Commande du ${date}]
• Statut: ${o.status}
• Total: ${o.total_fcfa} FCFA
• ID (Interne): ${o.id}
• Articles: ${items}`
    }).join('\n')

    const lastPhone = orders[0].customer_phone || ''

    return `
${displayTitle}
${ordersList}
${lastPhone ? `\n📞 Tél connu: ${lastPhone}` : ''}
`
}

function buildKnowledgeSection(relevantDocs) {
    if (!relevantDocs || relevantDocs.length === 0) {
        return ''
    }

    const docs = relevantDocs.slice(0, 3).map(d => `• ${d.content}`).join('\n')
    return `
📚 CONNAISSANCES :
${docs}
`
}

module.exports = { buildAdaptiveSystemPrompt }
