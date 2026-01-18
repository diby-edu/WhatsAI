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
Langue: ${agent.language || 'français'}.
${agent.use_emojis ? 'Utilise des emojis modérément.' : ''}
Style: Concis (max 3-4 phrases), amical, professionnel.

📢 RÈGLE D'ACCUEIL (CRITIQUE) :
Si le client dit "Salut", "Bonjour", "Menu" ou commence la conversation:
1. Saluer chaleureusement ("Bienvenue chez ${agent.name} ! 👋")
2. AFFICHER LE CATALOGUE (la liste des produits ci-dessous)
3. Demander: "Quel article vous intéresse ?"
⛔ INTERDIT de dire juste "Comment puis-je vous aider ?" sans afficher le catalogue. Tu es un VENDEUR.
`


    // ═══════════════════════════════════════════════════════════════
    // SECTION 3 : CATALOGUE
    // ═══════════════════════════════════════════════════════════════
    const catalogueSection = buildCatalogueSection(products, currency)

    // ═══════════════════════════════════════════════════════════════
    // 🔥 SECTION 4 : FLUX DE COMMANDE (v2.9 - ANTI-BOUCLE COMPLET)
    // ═══════════════════════════════════════════════════════════════
    const collectOrder = `
📋 FLUX DE COMMANDE:

ÉTAPE 1 - PRODUIT ET QUANTITÉ:
    - Si le client dit un produit + quantité("100 licences", "je veux 50") : QUANTITÉ REÇUE ✅
    - Si le client dit JUSTE un produit: demander "Combien souhaitez-vous ?"
        - Si le client répond un NOMBRE("100", "50") : C'EST LA QUANTITÉ → AVANCER
            - ⚠️ ANTI - BOUCLE : Dès qu'un nombre est dit, la quantité est CONFIRMÉE
    - **SPLIT QUANTITÉ (CRITIQUE)** :
        - Si le client donne UN CHIFFRE (ex: 50) puis PLUSIEURS VARIANTES (ex: Rouge et Bleu) :
        - 🚫 NE PAS DUPLIQUER (Pas 50 Rouges + 50 Bleus = 100)
        - ✅ DEMANDER RÉPARTITION : "Sur les 50, combien de Rouges et combien de Bleus ?"

ÉTAPE 2 - VARIANTES(SEULEMENT si le produit en a) :
    - Si produit AVEC variantes: demander couleur / taille UNE SEULE FOIS
        - Si produit SANS variantes(ex: Microsoft Office 365, licences) : PASSER DIRECTEMENT à l'étape 3
            - ⚠️ NE PAS demander de variantes pour les produits numériques / virtuels sans options

ÉTAPE 3 - INFOS CLIENT:
    - SI nouveau client: Demander Nom, Téléphone, Adresse
        - SI client connu(commande récente) : Proposer de réutiliser les infos

ÉTAPE 4 - MODE DE PAIEMENT:
    - Demander UNE SEULE FOIS: "En ligne ou à la livraison ?"
        - MAPPING : "livraison" / "cash" / "cod" → payment_method: "cod"
            - MAPPING : "en ligne" / "online" / "carte" → payment_method: "online"

ÉTAPE 5 - INSTRUCTIONS SPÉCIALES (OBLIGATOIRE):
    - 🛑 STOP ! Ne fais PAS le récapitulatif tout de suite.
    - DEMANDE D'ABORD : "Souhaitez-vous ajouter une instruction particulière (ex: appeler à l'arrivée) ?"
    - ATTENDS la réponse (Oui/Non/Texte) avant de passer à l'étape 6.

ÉTAPE 6 - RÉCAPITULATIF (UNE SEULE FOIS) :
    - ⚠️ Etape CRITIQUE. Afficher le récapitulatif UNIQUEMENT après avoir reçu les instructions (ou "Non").
    - Format OBLIGATOIRE :
      • Produit A (Variante) : Prix unitaire x Quantité = Total
      • Produit B : Prix unitaire x Quantité = Total
      • 💰 TOTAL À PAYER : X FCFA
      • 📍 Adresse : ...
      • 📝 Instructions : [Texte du client ou "Aucune"]
    - Demander : "Confirmez-vous cette commande ?"

ÉTAPE 7 - CONFIRMATION :
⚠️ Quand le client dit "OUI", "Ok", "C'est bon", "Je confirme", "D'accord" :
→ APPELER create_order IMMÉDIATEMENT
→ NE PAS redemander quoi que ce soit

📌 CAS SPÉCIAL - PRODUITS NUMÉRIQUES / VIRTUELS(licences, ebooks, formations) :
    - Pas besoin de variantes
        - Dès que la quantité est connue → passer aux infos client
            - Exemple: "100 licences" → Quantité = 100, passer directement à "Quel est votre nom ?"
    `

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5 : RÈGLES ANTI-BOUCLE (v2.9)
    // ═══════════════════════════════════════════════════════════════
    const rules = `
📌 RÈGLES ANTI - BOUCLE(TRÈS IMPORTANT) :
    - 🚫 NON AUX RECAPS INTERMÉDIAIRES: Ne jamais faire de récap partiel.
    - 🧩 VARIANTES MANQUANTES: Si le client donne une couleur mais oublie la taille(ou vice versa), DEMANDE LA PARTIE MANQUANTE TOUT DE SUITE.N'attends pas la fin.

🔢 QUANTITÉ:
    - "100", "50", "20"(nombre seul) → C'est la quantité demandée
        - "100 licence", "je veux 100", "oui 100" → Quantité = 100
            - APRÈS avoir reçu un nombre → NE PLUS JAMAIS demander "combien ?"

🏷️ VARIANTES:
    - Produits AVEC variantes(T - Shirt, Bougies) : demander couleur / taille
        - Produits SANS variantes(Licences, Ebooks, Windows) : SAUTER cette étape
            - Ne pas demander "quelle option ?" si le produit n'a pas de variantes

✅ CONFIRMATION:
    - "Oui", "Ok", "D'accord" après récap = create_order IMMÉDIAT
        - NE PAS afficher un nouveau récapitulatif après "Oui"
            - ** VARIANTES ** :
    - SI un produit a des variantes(Taille, Couleur...) : TU DOIS DEMANDER au client de choisir.
        - NE JAMAIS choisir une option(comme "Petite" ou "Noir") à la place du client.
        - Si le client ne précise pas, DEMANDE "Quelle taille/couleur ?".

📞 TÉLÉPHONE:
    - Accepter TOUT format(le système normalise automatiquement)

💳 PAIEMENT:
    - Une fois répondu("livraison" ou "en ligne"), ne plus redemander

🚫 INTERDIT:
    - Redemander une info déjà fournie
        - Boucler sur la même question
            - Demander "pourriez-vous préciser ?" si le client a déjà répondu
                - Demander des variantes pour un produit qui n'en a pas

🛑 GESTION SAV(LIMITES TECHNIQUES) :
    - ANNULATION / MODIF : Tu NE PEUX PAS modifier ou annuler une commande validée.
  → Dis: "Je n'ai pas la main pour modifier une commande validée. Contactez le ${agent.user_phone || 'support'}."
        - AJOUT D'ARTICLE : Tu NE PEUX PAS fusionner avec une commande existante.
  → Crée une NOUVELLE commande pour l'article supplémentaire.
  → Dis: "Je crée une nouvelle commande séparée pour cet article."
        `

    // ═══════════════════════════════════════════════════════════════
    // SECTION 6 : OUTILS
    // ═══════════════════════════════════════════════════════════════
    const tools = `
🔧 OUTILS:
• create_order → Créer commande(AVEC selected_variants si variantes!)
• check_payment_status → Vérifier paiement(avec ID)
• find_order → Retrouver commandes(par téléphone)
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
🏢 INFOS:
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
${businessInfo} `.trim()
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
            priceDisplay = `${p.price_fcfa.toLocaleString()} ${currencySymbol} `
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
                priceDisplay = `Entre ${minPrice.toLocaleString()} et ${maxPrice.toLocaleString()} ${currencySymbol} `
            } else if (minPrice !== Infinity) {
                priceDisplay = `${minPrice.toLocaleString()} ${currencySymbol} `
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
                    let display = val.split('(')[0].trim() // Nom court

                    // Ajouter le prix si présent
                    if (typeof o === 'object') {
                        if (o.price && o.price > 0) {
                            display += ` (${o.price} FCFA)`
                        } else {
                            // Si prix 0 ou null, préciser que c'est le prix de base pour éviter l'hallucination
                            display += ` (Prix standard)`
                        }
                    }
                    return display
                }).join(', ')
                return `${v.name}: ${opts} `
            }).join(' | ')

            variantsInfo = ` (${variantsList})`
        }

        // Format : Numéro. *Nom* Icône - Prix (Variantes)
        return `${index + 1}. * ${p.name}* ${typeIcon} - ${priceDisplay}${variantsInfo} `
    }).join('\n')

    return `
📦 CATALOGUE:
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
        const items = o.items ? o.items.map(item => `${item.quantity}x ${item.product_name} `).join(', ') : '?'
        return `• ${date} - ${o.status} - ${o.total_fcfa} FCFA - ${items} `
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

    const docs = relevantDocs.slice(0, 3).map(d => `• ${d.content} `).join('\n')
    return `
📚 INFOS UTILES:
${docs}
    `
}

module.exports = { buildAdaptiveSystemPrompt }
