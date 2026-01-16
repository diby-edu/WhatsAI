/**
 * ═══════════════════════════════════════════════════════════════
 * PROMPT BUILDER v2.5 - VARIANTES EN PREMIER (Fix Priorité GPT)
 * ═══════════════════════════════════════════════════════════════
 * 
 * CHANGEMENT MAJEUR v2.5 :
 * Les instructions sur selected_variants sont maintenant AU TOUT DÉBUT
 * du prompt, pas au milieu. GPT accorde plus d'importance aux premières
 * instructions qu'à celles du milieu.
 * 
 * STRUCTURE DU PROMPT :
 * 1. 🚨 RÈGLE CRITIQUE : VARIANTES (EN PREMIER !)
 * 2. Identité de l'agent
 * 3. Catalogue (avec rappels variantes)
 * 4. Autres principes
 * 5. Historique client
 * 6. Infos entreprise
 */

function buildAdaptiveSystemPrompt(agent, products, orders, relevantDocs, currency, gpsLink, formattedHours) {

    // ═══════════════════════════════════════════════════════════════
    // 🚨 SECTION 1 : VARIANTES - DOIT ÊTRE EN PREMIER !
    // ═══════════════════════════════════════════════════════════════
    const variantsFirst = `
🚨🚨🚨 RÈGLE ABSOLUE - LIS CECI EN PREMIER 🚨🚨🚨

QUAND TU APPELLES create_order POUR UN PRODUIT AVEC VARIANTES :
Tu DOIS utiliser le champ "selected_variants" dans chaque item.

EXEMPLE OBLIGATOIRE :
{
  "items": [{
    "product_name": "T-Shirt Premium en coton bio",
    "quantity": 10,
    "selected_variants": {
      "Taille": "Moyenne",
      "Couleur": "Bleu Marine"
    }
  }],
  "customer_name": "Koli Koli",
  "customer_phone": "2250976536780",
  "delivery_address": "Port Bouet 2"
}

⛔ SI TU OUBLIES "selected_variants" → LA COMMANDE ÉCHOUERA !
⛔ NE JAMAIS appeler create_order sans avoir TOUTES les variantes !

AVANT D'APPELER create_order, VÉRIFIE :
✓ J'ai demandé TOUTES les variantes au client ? (Taille ET Couleur)
✓ J'ai mis les réponses dans "selected_variants" ?
✓ Les noms correspondent au catalogue ? ("Taille", "Couleur", etc.)

🚨🚨🚨 FIN DE LA RÈGLE ABSOLUE 🚨🚨🚨
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2 : IDENTITÉ
    // ═══════════════════════════════════════════════════════════════
    const identity = `
Tu es l'assistant IA de ${agent.name}. 
Langue : ${agent.language || 'français'}. 
${agent.use_emojis ? 'Utilise des emojis modérément.' : 'Pas d\'emojis.'}

Ta mission : Transformer chaque conversation en vente réussie.
Sois concis (max 3-4 phrases par message).
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3 : CATALOGUE (avec rappels variantes intégrés)
    // ═══════════════════════════════════════════════════════════════
    const catalogueSection = buildCatalogueSection(products, currency)

    // ═══════════════════════════════════════════════════════════════
    // SECTION 4 : ORDRE DE COLLECTE
    // ═══════════════════════════════════════════════════════════════
    const collectOrder = `
📋 ORDRE DE COLLECTE (respecte cet ordre) :

1. Produit + Quantité → "Combien voulez-vous ?"
2. VARIANTES (si le produit en a) → "Quelle taille ? Quelle couleur ?"
3. Nom → "Votre nom complet ?"
4. Téléphone → "Votre numéro ?"
5. Adresse → "Adresse de livraison ?"
6. create_order avec selected_variants ✅

⚠️ Ne saute JAMAIS l'étape 2 si le produit a des variantes !
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5 : AUTRES PRINCIPES (condensés)
    // ═══════════════════════════════════════════════════════════════
    const otherPrinciples = `
📌 AUTRES RÈGLES :

• TÉLÉPHONE : Accepte tout format, ne bloque jamais.
• PRIX : Utilise UNIQUEMENT les prix du catalogue. N'invente JAMAIS.
• ESCALADE : Si client mécontent → "Je transmets à l'équipe."
• PAIEMENT : Après create_order, suis les instructions retournées.
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 6 : OUTILS
    // ═══════════════════════════════════════════════════════════════
    const tools = `
🔧 OUTILS :

• create_order → Créer commande (⚠️ AVEC selected_variants !)
• check_payment_status → Vérifier paiement
• send_image → Montrer un produit
• create_booking → Réserver un service
`

    // ═══════════════════════════════════════════════════════════════
    // SECTION 7 : HISTORIQUE & INFOS
    // ═══════════════════════════════════════════════════════════════
    const clientHistory = buildClientHistory(orders)
    const knowledgeSection = buildKnowledgeSection(relevantDocs)
    
    const businessInfo = agent.business_address || gpsLink || formattedHours !== 'Non spécifiés' 
        ? `
🏢 INFOS ENTREPRISE :
${agent.business_address ? `Adresse : ${agent.business_address}` : ''}
${gpsLink ? `GPS : ${gpsLink}` : ''}
${formattedHours !== 'Non spécifiés' ? `Horaires : ${formattedHours}` : ''}
` : ''

    // ═══════════════════════════════════════════════════════════════
    // ASSEMBLAGE FINAL - VARIANTES EN PREMIER !
    // ═══════════════════════════════════════════════════════════════
    return `${variantsFirst}
${identity}
${catalogueSection}
${collectOrder}
${otherPrinciples}
${tools}
${clientHistory}
${knowledgeSection}
${businessInfo}`
}

/**
 * Build Catalogue avec RAPPELS VARIANTES pour chaque produit
 */
function buildCatalogueSection(products, currency) {
    if (!products || products.length === 0) {
        return `
📦 CATALOGUE : Aucun produit configuré.
`
    }

    const catalogueItems = products.map(p => {
        const typeIcon = p.product_type === 'service' ? '🛎️' :
            p.product_type === 'virtual' ? '💻' : '📦'

        let priceDisplay = p.price_fcfa
            ? `${p.price_fcfa.toLocaleString()} ${currency === 'XOF' ? 'FCFA' : currency}`
            : 'Selon variante'

        // VARIANTES avec rappel selected_variants
        let variantsInfo = ''
        if (p.variants && p.variants.length > 0) {
            const variantsList = p.variants.map(v => {
                const opts = v.options.map(o => {
                    if (typeof o === 'string') return o
                    return o.value || o.name
                }).join(', ')
                return `${v.name}: [${opts}]`
            }).join(' | ')
            
            variantsInfo = `
   ⚠️ VARIANTES: ${variantsList}
   → Tu DOIS mettre ces variantes dans selected_variants !`
        }

        return `• ${p.name} ${typeIcon} - ${priceDisplay}${variantsInfo}`
    }).join('\n')

    return `
📦 CATALOGUE :
${catalogueItems}
`
}

function buildClientHistory(orders) {
    if (!orders || orders.length === 0) {
        return `📜 CLIENT : Nouveau client.`
    }

    const lastOrder = orders[0]
    return `
📜 CLIENT CONNU :
Dernière commande : #${lastOrder.id?.substring(0, 8) || '?'} (${lastOrder.status})
${lastOrder.customer_phone ? `Tél : ${lastOrder.customer_phone.substring(0, 8)}***` : ''}
`
}

function buildKnowledgeSection(relevantDocs) {
    if (!relevantDocs || relevantDocs.length === 0) {
        return ''
    }
    const docsContent = relevantDocs.slice(0, 3).map(d => `• ${d.content}`).join('\n')
    return `
📚 CONNAISSANCES :
${docsContent}
`
}

module.exports = { buildAdaptiveSystemPrompt }
