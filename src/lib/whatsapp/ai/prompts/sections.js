
/**
 * Convertit un prix stocké en FCFA vers la devise d'affichage.
 * Les prix en DB sont TOUJOURS en FCFA (price_fcfa).
 * Taux : 1 USD = 655 FCFA, 1 EUR ≈ 656 FCFA
 */
function convertFromFcfa(priceFcfa, currency) {
    if (!priceFcfa || priceFcfa === 0) return 0
    if (currency === 'USD') return Math.round(priceFcfa / 700)
    if (currency === 'EUR') return Math.round(priceFcfa / 700)
    return priceFcfa // XOF : pas de conversion
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

    // v2.41: Liste de noms uniquement — les détails sont affichés quand un produit est sélectionné
    const catalogueItems = products.map((p, index) => {
        return `${index + 1}. ${p.name}`
    }).join('\n')

    return `
📦 CATALOGUE (${products.length} article${products.length > 1 ? 's' : ''}) :
${catalogueItems}
    `
}

/**
 * ═══════════════════════════════════════════════════════════════
 * HISTORIQUE CLIENT - 15 jours avec fallback
 * ═══════════════════════════════════════════════════════════════
 */
function buildClientHistory(orders) {
    // Modif v2.28: Afficher TOUT l'historique disponible (max 10) sans filtre de date
    // (Le filtre est déjà fait par la requête DB limit 20)
    let recentOrders = orders || []

    let displayTitle = '📜 HISTORIQUE RÉCENT :'
    if (recentOrders.length === 0) {
        return '\n📜 CLIENT : Nouveau client (ou pas de commande récente)\n'
    }

    const ordersList = recentOrders.slice(0, 10).map(o => {
        const date = new Date(o.created_at).toLocaleDateString('fr-FR')
        const items = o.items ? o.items.map(item => {
            const variantStr = item.selected_variants ? `(${Object.values(item.selected_variants).join(', ')})` : ''
            return `${item.quantity}x ${item.product_name} ${variantStr}`
        }).join(', ') : '?'
        return `• [${o.id.slice(0, 8)}] ${date} (${o.status}) : ${items} (Total: *${o.total_fcfa} FCFA*)`
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

module.exports = {
    buildCatalogueSection,
    buildClientHistory,
    buildKnowledgeSection
}
