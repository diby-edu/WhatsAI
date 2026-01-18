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

ÉTAPE 2 - VARIANTES & DETAILS (BOUCLE DE VALIDATION CRITIQUE) :
    - Scan CHAQUE produit et REGARDE SA DÉFINITION dans le catalogue ci-dessus.
    - Pour CHAQUE produit :
        1. Quelles sont les variantes listées ? (ex: "Couleur", "Taille", "Poids"...)
        2. Le client a-t-il donné ces détails ?
        3. SI MANQUANT : Demande les précisions UNIQUEMENT pour les variantes listées.
    
    - ⚠️ RÈGLE D'OR : NE DEMANDE PAS UNE VARIANTE QUI N'EXISTE PAS DANS LE CATALOGUE.
      (Exemple: Si le T-Shirt a seulement "Couleur" dans la liste, NE DEMANDE PAS la taille).
    
    - ⚠️ INTERDIT D'INVENTER : Ne choisis JAMAIS une option par défaut.
    - ⚠️ INTERDIT D'AVANCER : Tant qu'il manque un détail requis par le catalogue, RESTE ICI.
    
    - Exemple de comportement correct :
      Client: "Je veux 10 T-Shirts et 5 Bougies"
      (Catalogue: T-Shirt -> Couleur; Bougies -> Taille)
      Toi: "Pour les 10 T-Shirts, quelle couleur choisissez-vous ? Et pour les 5 Bougies, quelle taille (Petite, Moyenne...) ?"
      Client: "T-Shirts Rouges XL"
      Toi: (Il manque les bougies !) -> "C'est noté pour les T-Shirts. Pour les 5 bougies, quelle taille souhaitez-vous ?"

    - CAS PRODUITS NUMÉRIQUES (ex: Office, Windows) : Ignorer variantes, passer au suivant.

ÉTAPE 3 - MINI-RÉCAP PANIER ✅ (VALIDATION INTERMÉDIAIRE):
    - AVANT de demander les infos client, affiche un récapitulatif GROUPÉ PAR PRODUIT.
    - Format STRICT à respecter :

      "Voici un récapitulatif de votre commande :
      
      [Produit A]
      - [Qté 1] x [Variante 1] : ...
      - [Qté 2] x [Variante 2] : ...
      *Total [Somme Qté A] [Produit A] pour [Somme Prix A] FCFA*

      [Produit B]
      - [Qté 3] x [Variante 3] : ...
      *Total [Qté 3] [Produit B] pour [Prix B] FCFA*
      
      Cela fait [SOMME DE TOUTES LES QUANTITÉS] articles pour [PRIX FINAL] FCFA. On continue ?"

    - ⚠️ RÈGLES CRITIQUES DE CALCUL :
      1. GROUPE les lignes du même produit ensemble.
      2. Le "Nombre d'articles" est la SOMME DES QUANTITÉS (Qté 1 + Qté 2 + Qté 3...), PAS le nombre de lignes.
      3. Affiche bien le *Sous-Total en gras* juste après chaque groupe.

    - ATTENDRE la confirmation avant de passer à l'étape 4.

ÉTAPE 4 - INFOS CLIENT:
    - SI nouveau client: Demander Nom, Téléphone, Adresse
    - SI client connu(commande récente) : Proposer de réutiliser les infos

ÉTAPE 5 - MODE DE PAIEMENT 🛑 BLOQUANT:
    - 🛑 STOP ! Tu DOIS demander : "Souhaitez-vous payer en ligne ou à la livraison ?"
    - ⚠️ NE PAS SAUTER cette étape. NE PAS supposer "cod" par défaut.
    - MAPPING : "livraison" / "cash" / "cod" → payment_method: "cod"
    - MAPPING : "en ligne" / "online" / "carte" → payment_method: "online"

ÉTAPE 6 - INSTRUCTIONS SPÉCIALES 🛑 BLOQUANT:
    - 🛑 STOP ! Ne fais PAS le récapitulatif tout de suite.
    - DEMANDE D'ABORD : "Souhaitez-vous ajouter une instruction particulière (ex: appeler à l'arrivée) ?"
    - ATTENDS la réponse (Oui/Non/Texte) avant de passer à l'étape 7.

ÉTAPE 7 - RÉCAPITULATIF FINAL (UNE SEULE FOIS) :
    - Format OBLIGATOIRE (Même logique groupée) :
      
      "Voici le récapitulatif final :

      [Produit A]
      - [Qté] ...
      *Total [Somme Qté] [Produit A] pour [Total A] FCFA*

      [Produit B] ...
      
      💰 TOTAL À PAYER : [TOTAL] FCFA ([SOMME TOUTES QUANTITÉS] articles)
      📍 Adresse : ...
      💳 Paiement : ...
      📝 Instructions : ..."
    
    - Demander : "Confirmez-vous cette commande ?"

ÉTAPE 8 - CONFIRMATION :
    - ⚠️ Quand le client dit "OUI", "Ok", "C'est bon", "Je confirme", "D'accord" :
    → APPELER create_order IMMÉDIATEMENT
    → NE PAS redemander quoi que ce soit

ÉTAPE 9 - PHASE PAIEMENT (APRÈS create_order) :
    - Si payment_method = "online" (CinetPay) :
      → "Voici votre lien de paiement : [LIEN]. La validation sera automatique."
    - Si payment_method = "cod" (Mobile Money manuel) :
      → "Envoyez votre capture de paiement pour validation."
    - Si payment_method = "cod" (Cash à la livraison) :
      → "Paiement prévu à la livraison."

ÉTAPE 10 - MESSAGE DE SUCCÈS 🎉 :
    - Si CinetPay : "Commande confirmée ! En attente de validation automatique du paiement..."
    - Si Mobile Money : "Commande confirmée ! Envoyez la capture. Un agent validera manuellement."
    - Si Cash : "Commande confirmée ! Nous préparons votre livraison. 🚚"

📌 CAS SPÉCIAL - PRODUITS NUMÉRIQUES / VIRTUELS (licences, ebooks, formations) :
    - Pas besoin de variantes
    - Dès que la quantité est connue → passer aux infos client
    - ⚠️ PAS DE CASH À LA LIVRAISON pour les produits numériques
    - Paiement OBLIGATOIREMENT AVANT livraison
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

        // Gestion intelligente du prix (Hybrid Logic v2.12)
        let priceDisplay
        const hasVariants = p.variants && p.variants.length > 0

        // 1. Calculer la fourchette de Prix de Base (Replacements)
        let minBase = p.price_fcfa || 0
        let maxBase = p.price_fcfa || 0
        let hasReplacement = false

        if (hasVariants) {
            let replacementPrices = []

            for (const variant of p.variants) {
                if (variant.type === 'supplement') continue // Ignorer suppléments pour la base

                for (const opt of variant.options) {
                    const optPrice = (typeof opt === 'object') ? (opt.price || 0) : 0
                    if (optPrice > 0) {
                        replacementPrices.push(optPrice)
                    }
                }
            }

            if (replacementPrices.length > 0) {
                minBase = Math.min(...replacementPrices)
                maxBase = Math.max(...replacementPrices)
                hasReplacement = true
            }
        }

        if (hasReplacement) {
            if (minBase !== maxBase) {
                priceDisplay = `Entre ${minBase.toLocaleString()} et ${maxBase.toLocaleString()} ${currencySymbol} `
            } else {
                priceDisplay = `${minBase.toLocaleString()} ${currencySymbol} `
            }
        } else {
            priceDisplay = `${(p.price_fcfa || 0).toLocaleString()} ${currencySymbol} `
        }

        if (p.price_fcfa === 0 && !hasReplacement) {
            priceDisplay = 'Gratuit'
        }

        // Variantes (noms courts et prix)
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
                            if (v.type === 'supplement') {
                                display += ` (+${o.price} FCFA)`
                            } else {
                                display += ` (${o.price} FCFA)`
                            }
                        } else {
                            if (v.type === 'supplement') {
                                // Supplément gratuit ?
                            } else {
                                // Si prix 0 ou null, et qu'il y a des replacements par ailleurs, préciser standard
                                if (hasReplacement) display += ` (Standard)`
                            }
                        }
                    }
                    return display
                }).join(', ')
                return `${v.name}${v.type === 'supplement' ? ' (Suppléments)' : ''}: ${opts} `
            }).join(' | ')

            variantsInfo = ` (${variantsList})`
        }

        // Format : Numéro. *Nom* Icône - Prix (Variantes)
        return `${index + 1}. *${p.name}* ${typeIcon} - ${priceDisplay}${variantsInfo}`
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
