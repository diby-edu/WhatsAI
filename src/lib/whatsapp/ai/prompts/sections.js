
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

/**
 * Mapping catégorie → label lisible pour l'affichage dans le prompt IA.
 * Permet de corriger les groupes mal nommés (ex: deux groupes "Couleur"
 * dont l'un est en réalité une taille).
 */
const CATEGORY_DISPLAY_NAMES = {
    visual: 'Couleur',
    size: 'Taille',
    weight: 'Poids',
    duration: 'Durée',
    room_type: 'Type de chambre',
    view: 'Vue',
    pension: 'Pension',
    menu: 'Menu',
    formula: 'Formule',
    service_type: 'Type de service',
    vehicle: 'Véhicule',
    option: 'Option',
    participants: 'Participants',
    version: 'Version',
    format: 'Format',
    language: 'Langue',
    license: 'Licence',
}

/**
 * Retourne le label lisible d'un groupe de variantes.
 * - category 'custom' → customName ou name
 * - catégories standard → CATEGORY_DISPLAY_NAMES (plus fiable que le champ name)
 */
function groupLabel(group, fallback) {
    if (!group) return fallback || '?'
    if (group.category === 'custom') return group.customName || group.name || fallback || '?'
    return CATEGORY_DISPLAY_NAMES[group.category] || group.name || fallback || '?'
}

/**
 * ═══════════════════════════════════════════════════════════════
 * CATALOGUE DÉTAILLÉ — Variantes et combinaisons résolues
 * Équivalent JS de la section productsCatalog dans openai.ts
 * Sans cette section le prompt ne contient que les noms, et l'IA
 * invente les variantes / prix.
 * ═══════════════════════════════════════════════════════════════
 */
function buildProductsCatalogSection(products, currency) {
    if (!products || products.length === 0) return ''

    let currencySymbol = 'FCFA'
    const toDisplay = (priceFcfa) => {
        if (!priceFcfa || priceFcfa === 0) return 0
        if (currency === 'USD') { currencySymbol = '$'; return Math.round(priceFcfa / 700) }
        if (currency === 'EUR') { currencySymbol = '€'; return Math.round(priceFcfa / 700) }
        return priceFcfa
    }

    const lines = products.map(p => {
        if (!p) return ''

        const displayPrice = toDisplay(p.price_fcfa || 0)

        // Helper : résoudre les IDs d'attributs en valeurs lisibles
        const resolveLabel = (combo) => {
            return Object.entries(combo.attributes || {}).map(([gId, oId]) => {
                const group = (p.variants || []).find(g => g.id === gId)
                const option = (group?.options || []).find(o => o.id === oId)
                return option?.value || oId
            }).join(' / ')
        }

        let variantsInfo = ''

        if (p.combinations && Array.isArray(p.combinations) && p.combinations.length > 0) {
            const available = p.combinations.filter(c => c.available !== false)
            const unavailable = p.combinations.filter(c => c.available === false)

            const prices = available.map(c => c.price).filter(v => v != null)
            const hasVariedPrices = prices.length > 0 && new Set(prices).size > 1

            if (!hasVariedPrices) {
                // Prix identiques : regrouper les options par groupe
                const groups = {}
                available.forEach(c => {
                    Object.entries(c.attributes || {}).forEach(([gId, oId]) => {
                        if (!groups[gId]) groups[gId] = new Set()
                        const group = (p.variants || []).find(g => g.id === gId)
                        const option = (group?.options || []).find(o => o.id === oId)
                        groups[gId].add(option?.value || oId)
                    })
                })

                const groupLines = Object.entries(groups).map(([gId, opts]) => {
                    const group = (p.variants || []).find(g => g.id === gId)
                    return `   ${groupLabel(group, gId)} : ${Array.from(opts).join(', ')}`
                }).join('\n')

                const attrNames = Object.keys(groups).map(gId => {
                    const g = (p.variants || []).find(g => g.id === gId)
                    return groupLabel(g, gId)
                }).join(', ')

                variantsInfo = `\n   💰 Prix : ${displayPrice.toLocaleString('fr-FR')} ${currencySymbol}\n${groupLines}`
                variantsInfo += `\n   ⚠️ COLLECTE : Demande CHAQUE attribut (${attrNames}) séparément avant de confirmer.`
            } else {
                // Prix variés : afficher les combinaisons
                const toShow = available.slice(0, 5)
                variantsInfo = `\n   🔗 COMBINAISONS DISPONIBLES :\n${toShow.map(c => {
                    const label = resolveLabel(c)
                    const price = c.price != null
                        ? `${Number(c.price).toLocaleString('fr-FR')} ${currencySymbol}`
                        : `${displayPrice.toLocaleString('fr-FR')} ${currencySymbol}`
                    return `      ✅ ${label} — ${price}`
                }).join('\n')}`
                if (available.length > 5) {
                    variantsInfo += `\n      ... et ${available.length - 5} autre(s).`
                }
                variantsInfo += `\n   ⚠️ RÈGLE : Présente ces combinaisons et note EXACTEMENT celle choisie.`
            }

            if (unavailable.length > 0) {
                variantsInfo += `\n   ❌ INDISPONIBLES : ${unavailable.map(resolveLabel).join(', ')}`
            }
        } else if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
            const vInfo = p.variants.map(v => {
                const label = groupLabel(v, v.name)
                const opts = (v.options || []).map(o => o.value || o.name).join(', ')
                return `${label} (${opts})`
            }).join(' | ')
            variantsInfo = `\n   🎨 VARIANTES : ${vInfo}`
        }

        return `🔹 ${p.name} — ${displayPrice.toLocaleString('fr-FR')} ${currencySymbol}${variantsInfo}\n   📝 ${p.description || ''}`
    }).filter(Boolean).join('\n\n')

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 DÉTAILS COMPLETS CATALOGUE (variantes & prix réels) :
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${lines}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ IMPORTANT : Utilise UNIQUEMENT les variantes listées ci-dessus. Ne jamais inventer d'autres options.
`
}

module.exports = {
    buildCatalogueSection,
    buildClientHistory,
    buildKnowledgeSection,
    buildProductsCatalogSection
}
