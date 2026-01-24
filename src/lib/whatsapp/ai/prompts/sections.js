
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
        // FIX: DB utilise 'digital' pas 'virtual'
        const typeIcon = p.product_type === 'service' ? '🛎️' :
            (p.product_type === 'virtual' || p.product_type === 'digital') ? '💻' : '📦'

        const hasVariants = p.variants && p.variants.length > 0

        // Séparer variantes fixes (prix de base) et suppléments (additifs)
        const fixedVariants = hasVariants ? p.variants.filter(v => v.type === 'fixed') : []
        const additiveVariants = hasVariants ? p.variants.filter(v => v.type === 'additive') : []

        // 1. Calculer la fourchette de Prix de Base (uniquement variantes fixed)
        let minBase = p.price_fcfa || 0
        let maxBase = p.price_fcfa || 0
        let hasFixedPrices = false

        if (fixedVariants.length > 0) {
            let fixedPrices = []
            for (const variant of fixedVariants) {
                for (const opt of variant.options) {
                    const optPrice = (typeof opt === 'object') ? (opt.price || 0) : 0
                    if (optPrice > 0) {
                        fixedPrices.push(optPrice)
                    }
                }
            }
            if (fixedPrices.length > 0) {
                minBase = Math.min(...fixedPrices)
                maxBase = Math.max(...fixedPrices)
                hasFixedPrices = true
            }
        }

        // Affichage du prix principal
        let priceDisplay
        if (hasFixedPrices) {
            if (minBase !== maxBase) {
                priceDisplay = `${minBase.toLocaleString()} à ${maxBase.toLocaleString()} ${currencySymbol}`
            } else {
                priceDisplay = `${minBase.toLocaleString()} ${currencySymbol}`
            }
        } else {
            priceDisplay = p.price_fcfa > 0 ? `${(p.price_fcfa || 0).toLocaleString()} ${currencySymbol}` : 'Gratuit'
        }

        // 2. Construire l'affichage des variantes FIXED (options principales)
        // v2.32: Format multi-lignes avec 🔸 pour meilleure lisibilité
        let fixedInfo = ''
        if (fixedVariants.length > 0) {
            const fixedList = fixedVariants.map(v => {
                const optLines = v.options.map(o => {
                    if (typeof o === 'string') return `      🔸 ${o}`
                    const val = o.value || o.name || ''
                    const optPrice = (typeof o === 'object') ? (o.price || 0) : 0
                    if (optPrice > 0) {
                        return `      🔸 ${val}: ${optPrice.toLocaleString()} ${currencySymbol}`
                    }
                    return `      🔸 ${val}`
                }).join('\n')
                return `   - ${v.name}:\n${optLines}`
            }).join('\n')
            fixedInfo = `\n${fixedList}`
        }

        // 3. Construire l'affichage des SUPPLÉMENTS (additifs)
        // v2.32: Format multi-lignes avec ➕
        let supplementInfo = ''
        if (additiveVariants.length > 0) {
            const suppList = additiveVariants.map(v => {
                const optLines = v.options.map(o => {
                    if (typeof o === 'string') return `      ➕ ${o}`
                    const val = o.value || o.name || ''
                    const optPrice = (typeof o === 'object') ? (o.price || 0) : 0
                    if (optPrice > 0) {
                        return `      ➕ ${val}: +${optPrice.toLocaleString()} ${currencySymbol}`
                    }
                    return `      ➕ ${val} (inclus)`
                }).join('\n')
                return `   - Suppléments:\n${optLines}`
            }).join('\n')
            supplementInfo = `\n${suppList}`
        }

        // Format multi-lignes pour les services avec variantes
        if (hasVariants && (fixedInfo || supplementInfo)) {
            return `${index + 1}. *${p.name}* ${typeIcon} - ${priceDisplay}${fixedInfo}${supplementInfo}`
        }

        // Format simple pour produits sans variantes
        return `${index + 1}. *${p.name}* ${typeIcon} - ${priceDisplay}`
    }).join('\n\n')

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
