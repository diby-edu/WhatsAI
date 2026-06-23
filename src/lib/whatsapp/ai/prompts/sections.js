
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

    // v2.42: Catalogue restaurant groupé par rubrique si menu_section_slug présent
    const SECTION_ORDER = ['starters', 'mains', 'extras', 'desserts', 'drinks']
    const SECTION_LABELS = {
        starters: 'Entrées',
        mains: 'Plats Principaux',
        extras: 'Suppléments',
        desserts: 'Desserts',
        drinks: 'Boissons'
    }

    const isRestaurantMenu = products.some(p => p.menu_section_slug)

    const sortRestaurantSectionProducts = (items) => [...items].sort((a, b) => {
        const aSort = Number.isFinite(Number(a.menu_sort_order)) ? Number(a.menu_sort_order) : Number.MAX_SAFE_INTEGER
        const bSort = Number.isFinite(Number(b.menu_sort_order)) ? Number(b.menu_sort_order) : Number.MAX_SAFE_INTEGER
        if (aSort !== bSort) return aSort - bSort
        return String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' })
    })

    if (isRestaurantMenu) {
        const sections = {}
        const noSection = []

        products.forEach(p => {
            if (p.menu_section_slug && SECTION_LABELS[p.menu_section_slug]) {
                if (!sections[p.menu_section_slug]) sections[p.menu_section_slug] = []
                sections[p.menu_section_slug].push(p)
            } else {
                noSection.push(p)
            }
        })

        const formatPrice = (p) => {
            if (!p.price_fcfa) return ''
            if (currency === 'USD' || currency === 'EUR') return ` — ${Math.round(p.price_fcfa / 700)} ${currency}`
            return ` — ${p.price_fcfa} FCFA`
        }

        let carte = '\n🍽️ CARTE :\n'
        SECTION_ORDER.forEach(slug => {
            if (sections[slug] && sections[slug].length > 0) {
                carte += `\n▸ ${SECTION_LABELS[slug]}\n`
                sortRestaurantSectionProducts(sections[slug]).forEach(p => {
                    carte += `  • ${p.name}${formatPrice(p)}\n`
                })
            }
        })
        if (noSection.length > 0) {
            carte += `\n▸ Autres\n`
            sortRestaurantSectionProducts(noSection).forEach(p => {
                carte += `  • ${p.name}${formatPrice(p)}\n`
            })
        }
        return carte
    }

    // Standard : liste numérotée — enrichie avec prix + description pour les produits numériques
    const formatCatalogPrice = (priceFcfa) => {
        if (!priceFcfa) return ''
        if (currency === 'USD' || currency === 'EUR') return ` — ${Math.round(priceFcfa / 700)} ${currency}`
        return ` — ${Number(priceFcfa).toLocaleString('fr-FR')} FCFA`
    }

    const catalogueItems = products.map((p, index) => {
        if (p.product_type === 'digital' || p.product_type === 'virtual') {
            const price = formatCatalogPrice(p.price_fcfa)
            const desc = p.description ? `\n   ${String(p.description).slice(0, 80)}` : ''
            return `${index + 1}. 💻 ${p.name}${price}${desc}`
        }
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
function buildKnowledgeSection(relevantDocs, maxDocs = null) {
    if (!relevantDocs || relevantDocs.length === 0) {
        return ''
    }

    // maxDocs = null → afficher tous les docs (mode support)
    // maxDocs = N    → limiter à N (mode mixte avec produits)
    const docsToUse = maxDocs !== null ? relevantDocs.slice(0, maxDocs) : relevantDocs

    const docs = docsToUse.map(d => {
        let line = `• ${d.content}`
        // Image principale
        const allImages = [] // { url, label }
        if (d.image_url) allImages.push({ url: d.image_url, label: d.image_label || null })
        // Images supplémentaires : string (ancien format) ou {url, label} (nouveau format)
        const extras = Array.isArray(d.extra_image_urls) ? d.extra_image_urls : []
        extras.forEach(item => {
            if (!item) return
            if (typeof item === 'string') allImages.push({ url: item, label: null })
            else if (item.url) allImages.push({ url: item.url, label: item.label || null })
        })

        if (allImages.length === 1) {
            const { url, label } = allImages[0]
            const desc = label || 'image'
            line += `\n  [IMAGE DISPONIBLE] — Si le client demande une photo, appelle send_image(product_name="${desc}", image_url="${url}").`
        } else if (allImages.length > 1) {
            line += `\n  [${allImages.length} IMAGES DISPONIBLES] — RÈGLE ABSOLUE : quand le client demande une photo, appelle send_image avec EXACTEMENT le product_name ET le image_url ci-dessous. NE PAS utiliser le nom du produit catalogue. Envoie UNIQUEMENT l'image qui correspond à la demande :`
            allImages.forEach(({ url, label }, i) => {
                const desc = label ? label : `Image ${i + 1}`
                line += `\n    - send_image(product_name="${desc}", image_url="${url}")`
            })
        }
        return line
    }).join('\n\n')

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
                // Prix identiques ou tous null : regrouper les options par groupe
                const groups = {}
                const groupOptionPrices = {} // { gId: { optValue: price } }
                available.forEach(c => {
                    Object.entries(c.attributes || {}).forEach(([gId, oId]) => {
                        if (!groups[gId]) { groups[gId] = new Set(); groupOptionPrices[gId] = {} }
                        const group = (p.variants || []).find(g => g.id === gId)
                        const option = (group?.options || []).find(o => o.id === oId)
                        const optValue = option?.value || oId
                        groups[gId].add(optValue)
                        if (option?.price && option.price > 0) {
                            groupOptionPrices[gId][optValue] = option.price
                        }
                    })
                })

                const groupLines = Object.entries(groups).map(([gId, opts]) => {
                    const group = (p.variants || []).find(g => g.id === gId)
                    const gPrices = groupOptionPrices[gId] || {}
                    const optStr = Array.from(opts).map(v => {
                        const op = gPrices[v]
                        return op ? `${v} (${toDisplay(op).toLocaleString('fr-FR')} ${currencySymbol})` : v
                    }).join(', ')
                    return `   ${groupLabel(group, gId)} : ${optStr}`
                }).join('\n')

                const attrNames = Object.keys(groups).map(gId => {
                    const g = (p.variants || []).find(g => g.id === gId)
                    return groupLabel(g, gId)
                }).join(', ')

                // Si les combinations ont price:null, calculer le prix réel depuis les options
                let effectivePriceDisplay = `${displayPrice.toLocaleString('fr-FR')} ${currencySymbol}`
                if (prices.length === 0) {
                    const allOptPrices = Object.values(groupOptionPrices).flatMap(ps => Object.values(ps))
                    if (allOptPrices.length > 0) {
                        const minP = Math.min(...allOptPrices)
                        const maxP = Math.max(...allOptPrices)
                        effectivePriceDisplay = minP === maxP
                            ? `${toDisplay(minP).toLocaleString('fr-FR')} ${currencySymbol}`
                            : `${toDisplay(minP).toLocaleString('fr-FR')} - ${toDisplay(maxP).toLocaleString('fr-FR')} ${currencySymbol}`
                    }
                }

                variantsInfo = `\n   💰 Prix : ${effectivePriceDisplay}\n${groupLines}`
                variantsInfo += `\n   ⚠️ COLLECTE : Demande CHAQUE attribut (${attrNames}) séparément avant de confirmer.`
            } else {
                // Prix variés : afficher les combinaisons
                const toShow = available.slice(0, 5)
                variantsInfo = `\n   🔗 CHOIX DISPONIBLES :\n${toShow.map(c => {
                    const label = resolveLabel(c)
                    const price = c.price != null
                        ? `${Number(c.price).toLocaleString('fr-FR')} ${currencySymbol}`
                        : `${displayPrice.toLocaleString('fr-FR')} ${currencySymbol}`
                    return `      ✅ ${label} — ${price}`
                }).join('\n')}`
                if (available.length > 5) {
                    variantsInfo += `\n      ... et ${available.length - 5} autre(s).`
                }
                variantsInfo += `\n   ⚠️ RÈGLE : Présente ces choix disponibles et note EXACTEMENT celui choisi.`
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

        const typeTag = p.product_type === 'digital' ? ' 💻 [NUMÉRIQUE]' : ''
        return `🔹 ${p.name}${typeTag} — ${displayPrice.toLocaleString('fr-FR')} ${currencySymbol}${variantsInfo}\n   📝 ${p.description || ''}`
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
