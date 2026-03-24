const {
    getOptionValue,
    productHasRealVariants,
    VARIANT_CATEGORY_LABELS,
} = require('../ai/tools/tool-helpers')
const { calculateItemPrice } = require('../ai/tools/pricing-logic')

const CART_STAGE = {
    IDLE: 'idle',
    COLLECTING_ITEM: 'collecting_item',
    CART_RECAP: 'cart_recap',
    CHECKOUT: 'checkout',
}

const VARIANT_PRIORITY = {
    visual: 10,   // Couleur en premier
    size: 20,     // Taille en second
    weight: 30,
    version: 40,
    format: 50,
}

const CURRENCY_RATES   = { USD: 700, EUR: 700, GBP: 800 }
const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£' }

function formatPrice(priceFcfa, currency = 'XOF') {
    if (priceFcfa == null) return null
    const amount = Number(priceFcfa)
    const rate = CURRENCY_RATES[currency]
    if (rate) {
        const converted = Math.round(amount / rate)
        const symbol = CURRENCY_SYMBOLS[currency]
        return currency === 'USD'
            ? `${symbol}${converted.toLocaleString('en-US')}`
            : `${converted.toLocaleString('fr-FR')} ${symbol}`
    }
    return `${amount.toLocaleString('fr-FR')} FCFA`
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

function cloneItem(item = null) {
    if (!item) return null

    return {
        product_id: item.product_id || null,
        product_name: item.product_name || null,
        quantity: item.quantity === null || item.quantity === undefined || item.quantity === ''
            ? null
            : (Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null),
        selected_variants: { ...(item.selected_variants || {}) },
        selected_variants_by_id: { ...(item.selected_variants_by_id || {}) },
        skipped_optional_variant_ids: Array.isArray(item.skipped_optional_variant_ids)
            ? [...item.skipped_optional_variant_ids]
            : [],
    }
}

function cloneCartLine(line = null) {
    if (!line) return null

    const clonedItem = cloneItem(line)
    return {
        ...clonedItem,
        line_id: line.line_id || null,
        unit_price: Number.isFinite(Number(line.unit_price)) ? Number(line.unit_price) : null,
        line_total: Number.isFinite(Number(line.line_total)) ? Number(line.line_total) : null,
    }
}

function cloneAwaitingField(field = null) {
    if (!field) return null
    return { ...field }
}

function migrateLegacyCartItems(cart = {}) {
    if (Array.isArray(cart.cart_items) && cart.cart_items.length > 0) {
        return cart.cart_items.map(cloneCartLine).filter(Boolean)
    }

    if (!cart.current_item) return []

    if (![CART_STAGE.CART_RECAP, CART_STAGE.CHECKOUT].includes(cart.stage)) {
        return []
    }

    const migratedItem = cloneItem(cart.current_item)
    if (!migratedItem?.product_id || !migratedItem?.quantity) {
        return []
    }

    return [{
        ...migratedItem,
        line_id: 'legacy-line',
        unit_price: null,
        line_total: null,
    }]
}

function cloneCartState(cart = {}) {
    const draftItem = cloneItem(cart.draft_item || cart.current_item)

    return {
        stage: cart.stage || CART_STAGE.IDLE,
        draft_item: draftItem,
        cart_items: migrateLegacyCartItems(cart),
        awaiting_field: cloneAwaitingField(cart.awaiting_field),
        last_prompt_kind: cart.last_prompt_kind || null,
        last_prompt_text: cart.last_prompt_text || null,
        updated_at: cart.updated_at || null,
    }
}

function getCartState(metadata = {}) {
    return cloneCartState(metadata.cart || {})
}

function setCartState(metadata = {}, cartState) {
    return {
        ...(metadata || {}),
        cart: {
            ...cloneCartState(cartState),
            updated_at: new Date().toISOString(),
        }
    }
}

function clearCartState(metadata = {}) {
    return {
        ...(metadata || {}),
        cart: null
    }
}

function isPositiveReply(text) {
    const normalized = normalizeText(text)
    return ['oui', 'ok', 'okay', 'daccord', "d'accord", 'on continue', 'continuer', 'cest bon', "c'est bon"].includes(normalized)
}

function isNegativeReply(text) {
    const normalized = normalizeText(text)
    return ['non', 'pas maintenant', 'modifier', 'je corrige', 'je veux modifier'].includes(normalized)
}

function wantsAnotherCombination(text) {
    const normalized = normalizeText(text)
    if (!normalized) return false

    return [
        'ajouter',
        'autre combinaison',
        'une autre combinaison',
        'encore',
        'je veux aussi',
        'ajouter une autre',
        'autre variante',
    ].some(term => normalized.includes(term))
}

function buildCartActionField() {
    return {
        type: 'cart_action',
        label: 'suite du panier',
        prompt: 'Voulez-vous ajouter un autre article ?'
    }
}

function findProductById(products = [], productId) {
    return (products || []).find(product => product.id === productId) || null
}

function findBestProduct(products = [], text) {
    const normalized = normalizeText(text)
    if (!normalized) return null

    const numericChoice = normalized.match(/^\d+$/)
    if (numericChoice) {
        const index = Number(numericChoice[0]) - 1
        if (products[index]) return products[index]
    }

    let bestProduct = null
    let bestScore = 0

    for (const product of products) {
        const productName = normalizeText(product.name)
        if (!productName) continue

        let score = 0
        if (normalized === productName) score = 120
        else if (normalized.includes(productName) || productName.includes(normalized)) score = 70
        else {
            const terms = normalized.split(' ').filter(term => term.length > 2)
            score = terms.filter(term => productName.includes(term)).length * 15
        }

        if (score > bestScore) {
            bestScore = score
            bestProduct = product
        }
    }

    return bestScore >= 30 ? bestProduct : null
}

function getVariantLabel(variant) {
    return variant.customName || VARIANT_CATEGORY_LABELS[variant.category] || variant.name
}

function getRequiredVariants(product) {
    if (!productHasRealVariants(product)) return []

    return (product.variants || [])
        .filter(variant =>
            Array.isArray(variant.options) &&
            variant.options.length > 0 &&
            variant.type !== 'supplement' &&
            variant.type !== 'additive'
        )
        .map((variant, index) => ({
            ...variant,
            label: getVariantLabel(variant),
            sort_priority: VARIANT_PRIORITY[variant.category] || (100 + index),
        }))
        .sort((a, b) => a.sort_priority - b.sort_priority)
}

function getOptionalVariants(product) {
    if (!productHasRealVariants(product)) return []

    return (product.variants || [])
        .filter(variant =>
            Array.isArray(variant.options) &&
            variant.options.length > 0 &&
            (variant.type === 'supplement' || variant.type === 'additive')
        )
        .map((variant, index) => ({
            ...variant,
            label: getVariantLabel(variant),
            sort_priority: VARIANT_PRIORITY[variant.category] || (200 + index),
        }))
        .sort((a, b) => a.sort_priority - b.sort_priority)
}

function getCollectibleVariants(product) {
    return [
        ...getRequiredVariants(product),
        ...getOptionalVariants(product),
    ]
}

function findStrictVariantOption(variant, text) {
    const normalizedText = normalizeText(text)
    if (!normalizedText || !variant?.options) return null

    // Tokens sans ponctuation : "3 s, 2 xxxl" → ["3", "s", "2", "xxxl"]
    const tokens = normalizedText.replace(/[,;.]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)

    const exact = variant.options.find(option => normalizeText(getOptionValue(option)) === normalizedText)
    if (exact) return exact

    const tokenExact = variant.options.find(option => {
        const normalizedValue = normalizeText(getOptionValue(option))
        return normalizedValue && tokens.includes(normalizedValue)
    })
    if (tokenExact) return tokenExact

    const partialSubstr = variant.options.find(option => {
        const normalizedValue = normalizeText(getOptionValue(option))
        if (!normalizedValue || normalizedValue.length < 2) return false
        return ` ${normalizedText} `.includes(` ${normalizedValue} `)
    })
    if (partialSubstr) return partialSubstr

    // Correspondance préfixe : "noir" → "Noire", "blanc" → "Blanc" (min 3 chars)
    return variant.options.find(option => {
        const normalizedValue = normalizeText(getOptionValue(option))
        if (!normalizedValue || normalizedValue.length < 3) return false
        return tokens.some(t => t.length >= 3 && (
            normalizedValue.startsWith(t) || t.startsWith(normalizedValue)
        ))
    }) || null
}

function extractQuantity(text) {
    const normalized = normalizeText(text)
    if (!normalized) return null

    const numbers = normalized.match(/\b\d{1,3}\b/g) || []
    if (numbers.length === 0) return null

    const quantity = Number(numbers[0])
    if (!Number.isFinite(quantity) || quantity <= 0) return null

    return quantity
}

/**
 * Extraction de quantité intelligente pour les segments multi-produits.
 * Distingue la quantité (1-2 chiffres en début ou fin isolée) des tailles
 * qui apparaissent au milieu du segment (ex: "41-43", "36", "XL").
 *
 * Cas gérés :
 *   "2 T-shirt Noir L"    → 2 (début)
 *   "T-shirt Noir L 2"    → 2 (fin isolée)
 *   "3 Chaussettes 41-43" → 3 (début)
 *   "Chaussettes 41-43 3" → 3 (fin isolée)
 */
function extractQuantityFromSegment(text) {
    const normalized = normalizeText(text)
    if (!normalized) return null

    // Cas 1 : nombre au DÉBUT suivi d'au moins un caractère non-chiffre
    const startMatch = normalized.match(/^(\d{1,3})(?:\s|$)/)
    if (startMatch) {
        const qty = Number(startMatch[1])
        if (qty > 0) return qty
    }

    // Cas 2 : nombre ISOLÉ en FIN (précédé d'un espace ou début de chaîne)
    const endMatch = normalized.match(/(?:^|\s)(\d{1,3})$/)
    if (endMatch) {
        const qty = Number(endMatch[1])
        if (qty > 0) return qty
    }

    return null
}

function getSelectedVariantValue(item, variantId) {
    return item?.selected_variants_by_id?.[variantId] || null
}

function setSelectedVariant(item, variant, value) {
    const label = getVariantLabel(variant)
    item.selected_variants = {
        ...(item.selected_variants || {}),
        [label]: value
    }
    item.selected_variants_by_id = {
        ...(item.selected_variants_by_id || {}),
        [variant.id]: value
    }
}

function extractVariantsFromText(product, text, draftItem) {
    const normalized = normalizeText(text)
    const captured = []
    const nextItem = cloneItem(draftItem)

    if (!product || !normalized) {
        return { item: nextItem, captured }
    }

    // Tokens sans ponctuation pour éviter "s," ≠ "s"
    const cleanNormalized = normalized.replace(/[,;.]/g, ' ').replace(/\s+/g, ' ').trim()
    const tokens = cleanNormalized.split(' ').filter(Boolean)

    for (const variant of getCollectibleVariants(product)) {
        if (getSelectedVariantValue(nextItem, variant.id)) continue

        // Détecter plusieurs valeurs pour la même variante (ex: "L et M", "Rouge et Bleu")
        // Si 2+ options matchent (exact, token, substring ou préfixe) → multi-ligne → IA gère
        const matchingOptions = variant.options.filter(option => {
            const val = normalizeText(getOptionValue(option))
            if (!val) return false
            if (val === normalized || tokens.includes(val) || ` ${normalized} `.includes(` ${val} `)) return true
            // Correspondance préfixe (min 3 chars) : "noir" → "Noire"
            if (val.length >= 3 && tokens.some(t => t.length >= 3 && (val.startsWith(t) || t.startsWith(val)))) return true
            return false
        })
        if (matchingOptions.length >= 2) {
            return { item: cloneItem(draftItem), captured: [], multiValue: true, multiVariant: variant, multiOptions: matchingOptions }
        }

        const option = findStrictVariantOption(variant, normalized)
        if (!option) continue

        const value = getOptionValue(option)
        setSelectedVariant(nextItem, variant, value)
        captured.push({
            type: 'variant',
            variant_id: variant.id,
            label: getVariantLabel(variant),
            value,
        })
    }

    return { item: nextItem, captured }
}

function hasDraftSelections(item) {
    if (!item) return false

    return Boolean(
        item.quantity ||
        Object.keys(item.selected_variants_by_id || {}).length > 0 ||
        Object.keys(item.selected_variants || {}).length > 0 ||
        (item.skipped_optional_variant_ids || []).length > 0
    )
}

function splitCombinationSegments(text) {
    if (!text) return []

    // Diviser sur le texte BRUT pour préserver les sauts de ligne comme séparateurs
    // (normalizeText collapse les \n avant le split et les perdrait)
    return text
        .split(/\s*(?:et|puis|\+)\s*|[;,]\s*|\n+\s*/i)
        .map(segment => normalizeText(segment))
        .filter(Boolean)
}

function hasAllRequiredVariants(product, item) {
    return getRequiredVariants(product).every(variant => !!getSelectedVariantValue(item, variant.id))
}

function findMatchingComboForPartial(product, item) {
    return (product.combinations || []).find(combo =>
        Object.entries(combo.attributes || {}).every(([gId, oId]) => {
            const group = (product.variants || []).find(g => g.id === gId)
            if (!group) return true
            const option = (group.options || []).find(o => o.id === oId)
            const selectedVal = item.selected_variants_by_id?.[gId] || ''
            return normalizeText(option?.value || '') === normalizeText(selectedVal)
        })
    ) || null
}

function parseBatchCombinationLines(product, text) {
    const segments = splitCombinationSegments(text)
    if (segments.length < 2) {
        return { status: 'not_batch', lines: [], segments: [] }
    }

    const lines = []
    const partialCombos = [] // combos complets en variantes mais sans quantité
    const missingVariantSegments = [] // segments avec quantité mais variantes manquantes

    for (const segment of segments) {
        const draftItem = createDraftItem(product)
        const quantity = extractQuantity(segment)

        if (!quantity) {
            // Pas de quantité : collecter les variantes du segment
            const variantCapture = extractVariantsFromText(product, segment, draftItem)

            if (variantCapture.multiValue && variantCapture.multiVariant && variantCapture.multiOptions) {
                // Plusieurs valeurs pour le même attribut dans un segment (ex: "rose blanc")
                // → créer un sub-item par option détectée
                for (const option of variantCapture.multiOptions) {
                    const subItem = createDraftItem(product)
                    setSelectedVariant(subItem, variantCapture.multiVariant, getOptionValue(option))
                    partialCombos.push(subItem)
                }
                continue
            }

            if (hasAllRequiredVariants(product, variantCapture.item)) {
                partialCombos.push(variantCapture.item)
                continue
            }

            // Certaines variantes capturées mais pas toutes → combo incomplet
            if (variantCapture.captured.length > 0) {
                partialCombos.push(variantCapture.item)
                continue
            }

            return { status: 'invalid', lines: [], segments }
        }

        draftItem.quantity = quantity
        const variantCapture = extractVariantsFromText(product, segment, draftItem)
        const completedItem = variantCapture.item

        if (!hasAllRequiredVariants(product, completedItem)) {
            // Quantité présente mais variantes manquantes → collecter pour prompt ciblé
            missingVariantSegments.push({ quantity, item: completedItem, segment })
            continue
        }

        const lineResult = buildLineFromDraft(product, completedItem, lines.length + 1)
        if (lineResult.error) {
            return { status: 'error', error: lineResult.error, lines: [], segments }
        }

        lines.push(lineResult.line)
    }

    // Des segments avaient une quantité mais des variantes manquantes → flow one-by-one
    if (missingVariantSegments.length > 0) {
        return {
            status: 'missing_variant_sequential',
            queue: missingVariantSegments.map(({ quantity, item }) => {
                const knownVals = Object.values(item.selected_variants || {}).filter(Boolean)
                const knownLabel = knownVals.length > 0 ? knownVals.join(' / ') : '?'
                return { quantity, item, known_label: knownLabel }
            }),
            lines: [],
            segments,
        }
    }

    // Tous les segments avaient des variantes mais aucune quantité
    if (partialCombos.length > 0 && lines.length === 0) {
        const hasIncomplete = partialCombos.some(item => !hasAllRequiredVariants(product, item))

        if (hasIncomplete) {
            // Certains combos ont des variantes manquantes → décrire ce qui manque et demander de re-préciser
            const descriptions = partialCombos.map(item => {
                if (!hasAllRequiredVariants(product, item)) {
                    const knownVals = Object.values(item.selected_variants || {}).filter(Boolean)
                    const label = knownVals.join(' / ')
                    const missingVars = getRequiredVariants(product)
                        .filter(v => !getSelectedVariantValue(item, v.id))
                        .map(v => getVariantLabel(v).toLowerCase())
                    return `${label} (${missingVars.join(', ')} ?)`
                }
                // Combo complet : utiliser l'ordre DB via resolveCombinationLabel
                const combo = findMatchingComboForPartial(product, item)
                if (combo) return resolveCombinationLabel(product, combo)
                return Object.values(item.selected_variants || {}).filter(Boolean).join(' / ')
            }).filter(Boolean)

            const firstMissingVar = getRequiredVariants(product).find(v =>
                partialCombos.some(item => !getSelectedVariantValue(item, v.id))
            )
            const availableOpts = firstMissingVar
                ? (firstMissingVar.options || []).map(o => getOptionValue(o)).filter(Boolean).join(', ')
                : ''

            return {
                status: 'missing_variants_and_quantities',
                prompt: `Je vois que vous souhaitez : ${descriptions.join(', ')}.\nMerci de préciser les informations manquantes et la quantité pour chaque.${availableOpts ? `\n${getVariantLabel(firstMissingVar)} disponibles : ${availableOpts}.` : ''}`,
                lines: [],
                segments,
            }
        }

        const comboLabels = partialCombos.map(item => {
            const combo = findMatchingComboForPartial(product, item)
            if (combo) return resolveCombinationLabel(product, combo)
            return Object.values(item.selected_variants || {}).filter(Boolean).join(' / ')
        }).filter(Boolean)
        return {
            status: 'missing_quantities',
            partialCombos,
            comboLabels,
            prompt: `Je vois que vous souhaitez : ${comboLabels.join(' et ')}.\nCombien de chaque ? (ex : "3 ${comboLabels[0]} et 2 ${comboLabels[1] || comboLabels[0]}")`,
            lines: [],
            segments,
        }
    }

    return { status: 'success', lines, segments }
}

function resolveCombinationLabel(product, combo) {
    return Object.entries(combo.attributes || {}).map(([gId, oId]) => {
        const group = (product.variants || []).find(g => g.id === gId)
        const option = (group?.options || []).find(o => o.id === oId)
        return option?.value || oId
    }).join(' / ')
}

function buildOrderExample(product) {
    const combos = (product.combinations || []).filter(c => c.available !== false)
    if (combos.length === 0) return '(ex : "2 articles")'
    const label1 = resolveCombinationLabel(product, combos[0])
    if (combos.length === 1) return label1 ? `(ex : "2 ${label1}")` : '(ex : "2 articles")'
    const label2 = resolveCombinationLabel(product, combos[1])
    if (label1 && label2) return `(ex : "2 ${label1} et 1 ${label2}")`
    if (label1) return `(ex : "2 ${label1}")`
    return '(ex : "2 articles")'
}

function hasPricedCombinations(product) {
    const combos = (product.combinations || []).filter(c => c.available !== false)
    if (combos.length < 2) return false
    const prices = combos.map(c => c.price).filter(p => p != null)
    return prices.length > 0 && new Set(prices).size > 1
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEAU D'AFFICHAGE DES PRIX
// N1 : prix identique sur tout le produit
// N2 : prix varie par une variante dominante (ex: couleur) mais constant pour les autres
// N3 : prix varie vraiment par combo individuel
// ─────────────────────────────────────────────────────────────────────────────
function detectPricingLevel(product) {
    const combos = (product.combinations || []).filter(c => c.available !== false)
    if (!hasPricedCombinations(product)) return 'N1'

    const variants = getRequiredVariants(product)
    // Tester chaque groupe : si regrouper par ce groupe donne des groupes iso-prix → N2
    for (const variant of variants) {
        const groups = {}
        let allHavePrice = true
        for (const combo of combos) {
            const oId = (combo.attributes || {})[variant.id]
            if (!oId) { allHavePrice = false; break }
            if (combo.price == null) { allHavePrice = false; break }
            if (!groups[oId]) groups[oId] = new Set()
            groups[oId].add(combo.price)
        }
        if (allHavePrice && Object.values(groups).every(priceSet => priceSet.size === 1)) {
            return 'N2' // ce groupe est le pivot de prix
        }
    }
    return 'N3'
}

// Construit le bloc d'affichage d'un produit selon son niveau de prix et son type.
// Produit digital : pas de variantes physiques, affichage simplifié.
// Produit service  : ne devrait pas arriver ici (flux booking), mais géré en fallback.
// maxCombos : nombre max de combos affichés pour N3
function buildProductBlock(product, maxCombos = 8, currency = 'XOF') {
    // Produit digital sans variantes requises → affichage simplifié
    if (product.product_type === 'digital') {
        const price = product.price_fcfa != null ? formatPrice(product.price_fcfa, currency) : null
        return {
            level: 'N1',
            text: price ? `*${product.name}* — ${price} (téléchargement immédiat)` : `*${product.name}* (téléchargement immédiat)`,
            hasOverflow: false,
            overflowCombos: [],
        }
    }

    const level = detectPricingLevel(product)
    const combos = (product.combinations || []).filter(c => c.available !== false)
    const requiredVariants = getRequiredVariants(product)

    // ── N1 : prix uniforme, affichage groupé par variante ──
    if (level === 'N1') {
        const basePrice = product.price_fcfa != null
            ? formatPrice(product.price_fcfa, currency)
            : (combos[0]?.price != null ? formatPrice(combos[0].price, currency) : null)
        const header = basePrice ? `*${product.name}* — ${basePrice}` : `*${product.name}*`

        const variantLines = requiredVariants.map(variant => {
            const label = getVariantLabel(variant)
            const opts = (variant.options || []).map(o => getOptionValue(o)).filter(Boolean).join(' · ')
            return `${label} : ${opts}`
        })
        return {
            level: 'N1',
            text: [header, ...variantLines].join('\n'),
            hasOverflow: false,
            overflowCombos: [],
        }
    }

    // ── N2 : prix par groupe pivot, afficher chaque option avec ses tailles dispo ──
    // Si le pivot n'est pas trouvé, on ne retourne pas — on laisse tomber vers N3.
    if (level === 'N2') {
        let pivotVariant = null
        let pivotGroups = {}
        for (const variant of requiredVariants) {
            const groups = {}
            let valid = true
            for (const combo of combos) {
                const oId = (combo.attributes || {})[variant.id]
                if (!oId || combo.price == null) { valid = false; break }
                if (!groups[oId]) groups[oId] = new Set()
                groups[oId].add(combo.price)
            }
            if (valid && Object.values(groups).every(s => s.size === 1)) {
                pivotVariant = variant
                pivotGroups = groups
                break
            }
        }

        if (pivotVariant) {
            const otherVariants = requiredVariants.filter(v => v.id !== pivotVariant.id)
            const lines = (pivotVariant.options || []).map(pivotOption => {
                const oId = pivotOption.id
                const oVal = getOptionValue(pivotOption)
                const availableCombos = combos.filter(c => (c.attributes || {})[pivotVariant.id] === oId)
                if (availableCombos.length === 0) return null

                const price = [...(pivotGroups[oId] || new Set())][0]
                const priceStr = price != null ? ` — ${formatPrice(price, currency)}` : ''

                if (otherVariants.length > 0) {
                    const otherVariant = otherVariants[0]
                    const availableOtherIds = new Set(availableCombos.map(c => (c.attributes || {})[otherVariant.id]).filter(Boolean))
                    const availableOpts = (otherVariant.options || [])
                        .filter(o => availableOtherIds.has(o.id))
                        .map(o => getOptionValue(o))
                        .filter(Boolean)
                        .join(' · ')
                    return `· ${oVal} : ${availableOpts}${priceStr}`
                }
                return `· ${oVal}${priceStr}`
            }).filter(Boolean)

            return {
                level: 'N2',
                text: `*${product.name}*\n${lines.join('\n')}`,
                hasOverflow: false,
                overflowCombos: [],
            }
        }
        // Pivot non trouvé → fall-through vers N3 ci-dessous (pas de récursion)
    }

    // ── N3 : prix par combo, liste tronquée à maxCombos ──
    const prices = combos.map(c => c.price).filter(p => p != null)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = minPrice === maxPrice
        ? formatPrice(minPrice, currency)
        : `${formatPrice(minPrice, currency)} à ${formatPrice(maxPrice, currency)}`

    const shown = combos.slice(0, maxCombos)
    const overflow = combos.slice(maxCombos)

    const comboLines = shown.map(combo => {
        const label = resolveCombinationLabel(product, combo)
        const price = combo.price != null ? ` — ${formatPrice(combo.price, currency)}` : ''
        return `· ${label}${price}`
    })

    // Nom court pour "plus [nom_court]"
    const shortName = normalizeText(product.name).split(' ')[0]
    if (overflow.length > 0) {
        comboLines.push(`(+ ${overflow.length} autres : tapez "plus ${shortName}")`)
    }

    return {
        level: 'N3',
        text: `*${product.name}* — ${priceRange}\n${comboLines.join('\n')}`,
        hasOverflow: overflow.length > 0,
        overflowCombos: overflow,
        shortName,
    }
}

// Détecte plusieurs produits dans un message client (seuil abaissé à 15)
// Les produits de type 'service' sont exclus (ils ont leur propre flux de réservation)
function detectMultipleProducts(text, products) {
    const eligibleProducts = products.filter(p => p.product_type !== 'service')
    const segments = text.split(/\s*(?:et|puis|,|\/|\+)\s*/i).map(s => normalizeText(s)).filter(Boolean)
    const seen = new Set()
    const result = []
    for (const segment of segments) {
        if (!segment || segment.length < 2) continue
        // findBestProduct avec seuil 15 au lieu de 30
        let best = null
        let bestScore = 0
        for (const product of eligibleProducts) {
            const productName = normalizeText(product.name)
            if (!productName) continue
            let score = 0
            if (segment === productName) score = 120
            else if (segment.includes(productName) || productName.includes(segment)) score = 70
            else {
                const terms = segment.split(' ').filter(t => t.length > 2)
                score = terms.filter(t => productName.includes(t)).length * 15
            }
            if (score >= 15 && score > bestScore) { bestScore = score; best = product }
        }
        if (best && !seen.has(best.id)) {
            seen.add(best.id)
            result.push(best)
        }
    }
    return result.length >= 2 ? result : []
}

// Construit le prompt multi-produits avec ①②③ numérotation
function buildMultiProductPrompt(products, currency = 'XOF') {
    const count = products.length
    const maxCombos = count >= 4 ? 3 : count === 3 ? 4 : count === 2 ? 6 : 8
    const NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']

    const overflow = {}
    const blocks = products.map((product, i) => {
        const block = buildProductBlock(product, maxCombos, currency)
        if (block.hasOverflow) overflow[product.id] = block.overflowCombos
        return `${NUMBERS[i] || `${i + 1}.`} ${block.text}`
    })

    // Exemple de réponse
    const exParts = products.slice(0, 3).map(p => {
        const name = p.name.split(' ')[0]
        const vars = getRequiredVariants(p)
        const opts = vars.map(v => (v.options || [])[0]).filter(Boolean).map(o => getOptionValue(o))
        return `2 ${name} ${opts.join(' ')}`
    })

    // Label dynamique selon les variantes réellement présentes
    const hasVariants = products.some(p => getRequiredVariants(p).length > 0)
    const fieldLabel = hasVariants ? 'Précisez variante(s) + quantité pour chaque :' : 'Précisez la quantité pour chaque :'

    const prompt = [
        'Voici les choix disponibles pour chaque article :',
        '',
        blocks.join('\n\n'),
        '',
        fieldLabel,
        `(ex : "${exParts.join(', ')}")`,
    ].join('\n')

    return { prompt, overflow }
}

/**
 * Parse une réponse client multi-produits.
 *
 * Formats supportés (tout en un ou ligne par ligne) :
 *   "2 Robe Noire XL, 1 Veste Rose S"
 *   "2 T-shirt Noir L\n1 Casquette Bleu\n3 Chaussettes 41-43"
 *   "T-shirt Noir L 2"  ← quantité en fin de segment
 *   "Casquette Bleu 1"
 *
 * Les produits de type 'service' sont ignorés (flux booking séparé).
 * Si la quantité est absente d'un segment, elle est supposée = 1.
 */
function parseMultiProductBatchLines(products, text) {
    const eligibleProducts = products.filter(p => p.product_type !== 'service')

    const segments = text
        .split(/\s*(?:et|puis|\+)\s*|[;,]\s*|\n+\s*/i)
        .map(s => normalizeText(s))
        .filter(Boolean)

    const lines = []

    for (const segment of segments) {
        if (!segment) continue

        // Trouver le produit pour ce segment (scoring par tokens)
        let targetProduct = null
        let bestScore = 0
        for (const product of eligibleProducts) {
            const productName = normalizeText(product.name)
            const terms = productName.split(' ').filter(t => t.length > 2)
            const score = terms.filter(t => segment.includes(t)).length * 20
                + (segment.includes(productName) ? 50 : 0)
            if (score > bestScore) { bestScore = score; targetProduct = product }
        }

        if (!targetProduct || bestScore === 0) {
            return { status: 'missing_product', segment, lines: [] }
        }

        // Quantité : extraction intelligente (début ou fin), défaut = 1
        const quantity = extractQuantityFromSegment(segment) || 1

        const draftItem = createDraftItem(targetProduct)
        draftItem.quantity = quantity
        const variantCapture = extractVariantsFromText(targetProduct, segment, draftItem)
        const completedItem = variantCapture.item

        // Les produits digitaux sans variante requise passent directement
        if (!hasAllRequiredVariants(targetProduct, completedItem)) {
            return { status: 'missing_variants', segment, product: targetProduct, lines: [] }
        }

        const lineResult = buildLineFromDraft(targetProduct, completedItem, lines.length + 1)
        if (lineResult.error) return { status: 'error', error: lineResult.error, lines: [] }
        lines.push(lineResult.line)
    }

    if (lines.length === 0) return { status: 'invalid', lines: [] }
    return { status: 'success', lines }
}

function buildAwaitingField(product, item, currency = 'XOF') {
    if (!item) return null

    const requiredVariants = getRequiredVariants(product)
    const allVariantsMissing = requiredVariants.length > 0 &&
        requiredVariants.every(v => !getSelectedVariantValue(item, v.id))

    // Début de collecte : aucune variante ni quantité — présenter avec N1/N2/N3
    if (!item.quantity && allVariantsMissing) {
        const block = buildProductBlock(product, 8, currency)
        const example = buildOrderExample(product)
        const basePrompt = block.text + '\n\n' + example

        if (block.level === 'N1' || block.level === 'N2') {
            return {
                type: 'quantity',
                label: block.level === 'N1' ? 'N1_grouped' : 'N2_by_color',
                prompt: basePrompt,
            }
        }

        // N3 : stocker l'overflow pour "plus [produit]"
        const field = { type: 'quantity', label: 'N3_combos', prompt: basePrompt }
        if (block.hasOverflow) {
            field.overflow = { [product.id]: block.overflowCombos }
        }
        return field
    }

    if (!item.quantity) {
        // Combo product avec variante(s) partiellement sélectionnée(s) :
        // filtrer les combos disponibles selon les choix déjà faits et afficher les restants
        if (hasPricedCombinations(product) && !allVariantsMissing) {
            const available = (product.combinations || []).filter(c => c.available !== false)
            const matched = available.filter(combo => {
                return Object.entries(combo.attributes || {}).every(([gId, oId]) => {
                    const group = (product.variants || []).find(g => g.id === gId)
                    if (!group) return true
                    const selectedVal = getSelectedVariantValue(item, gId)
                    if (!selectedVal) return true // variante pas encore choisie, on garde
                    const option = (group.options || []).find(o => o.id === oId)
                    return (option?.value || '') === selectedVal
                })
            })

            const missingVariant = requiredVariants.find(v => !getSelectedVariantValue(item, v.id))
            if (missingVariant && matched.length > 0) {
                // Extraire les options restantes pour la variante manquante
                const remainingOptions = [...new Set(matched.map(combo => {
                    const oId = (combo.attributes || {})[missingVariant.id]
                    const option = (missingVariant.options || []).find(o => o.id === oId)
                    return option?.value || oId
                }).filter(Boolean))]

                const optStr = remainingOptions.join(' ou ')
                return {
                    type: 'quantity',
                    label: 'quantite_et_variante',
                    prompt: `Combien souhaitez-vous et quelle ${getVariantLabel(missingVariant).toLowerCase()} ?${optStr ? ` (${optStr} disponible${remainingOptions.length > 1 ? 's' : ''} dans ce choix)` : ''}`
                }
            }
        }

        return {
            type: 'quantity',
            label: 'quantite',
            prompt: 'Combien souhaitez-vous en commander ?'
        }
    }

    for (const variant of requiredVariants) {
        if (getSelectedVariantValue(item, variant.id)) continue

        const options = (variant.options || [])
            .map(option => getOptionValue(option))
            .filter(Boolean)
            .join(', ')

        return {
            type: 'variant',
            variant_id: variant.id,
            label: getVariantLabel(variant),
            prompt: `Quelle ${getVariantLabel(variant).toLowerCase()} souhaitez-vous ?${options ? ` (${options})` : ''}`
        }
    }

    for (const variant of getOptionalVariants(product)) {
        const skipped = Array.isArray(item.skipped_optional_variant_ids) && item.skipped_optional_variant_ids.includes(variant.id)
        if (skipped || getSelectedVariantValue(item, variant.id)) continue

        const options = (variant.options || [])
            .map(option => getOptionValue(option))
            .filter(Boolean)
            .join(', ')

        return {
            type: 'optional_variant',
            variant_id: variant.id,
            label: getVariantLabel(variant),
            prompt: `Souhaitez-vous ajouter ${getVariantLabel(variant).toLowerCase()} ?${options ? ` (${options})` : ''}`
        }
    }

    return null
}

function createDraftItem(product) {
    return {
        product_id: product.id,
        product_name: product.name,
        quantity: null,
        selected_variants: {},
        selected_variants_by_id: {},
        skipped_optional_variant_ids: [],
    }
}

function buildCapturedSummary(captured = []) {
    if (!captured || captured.length === 0) return ''

    const parts = captured.map(entry => {
        if (entry.type === 'quantity') return `quantite ${entry.value}`
        return `${entry.label.toLowerCase()} ${entry.value}`
    })

    if (parts.length === 1) return `Parfait !`
    return `Parfait !`
}

function buildLineFromDraft(product, draftItem, index = 1) {
    const selectedVariantsMap = { ...(draftItem.selected_variants || {}) }
    const pricing = calculateItemPrice(product, selectedVariantsMap, draftItem.product_name, draftItem.quantity)
    if (pricing.error) {
        return { error: pricing.error }
    }

    const unitPrice = pricing.price || product.price_fcfa || 0
    const lineTotal = unitPrice * draftItem.quantity

    // Variantes triées par priorité (couleur avant taille) pour l'affichage panier
    // selected_variants_by_id est keyed par UUID — correspondance correcte avec v.id
    const sortedVariantLabels = getRequiredVariants(product)
        .map(v => (draftItem.selected_variants_by_id || {})[v.id])
        .filter(Boolean)

    return {
        line: {
            ...cloneItem(draftItem),
            line_id: `line_${Date.now()}_${index}`,
            unit_price: unitPrice,
            line_total: lineTotal,
            variant_labels: sortedVariantLabels.length > 0 ? sortedVariantLabels : null,
        }
    }
}

function getLineSignature(line) {
    const variantsById = line.selected_variants_by_id || {}
    const signature = Object.keys(variantsById)
        .sort()
        .map(key => `${key}:${variantsById[key]}`)
        .join('|')

    return `${line.product_id}::${signature}`
}

function mergeOrAppendCartLine(cartItems = [], newLine) {
    const signature = getLineSignature(newLine)
    let merged = false

    const nextItems = cartItems.map(item => {
        if (merged || getLineSignature(item) !== signature || item.unit_price !== newLine.unit_price) {
            return cloneCartLine(item)
        }

        merged = true
        const quantity = (item.quantity || 0) + (newLine.quantity || 0)
        return {
            ...cloneCartLine(item),
            quantity,
            line_total: (item.unit_price || 0) * quantity,
        }
    })

    if (!merged) {
        nextItems.push(cloneCartLine(newLine))
    }

    return nextItems
}

function formatLineLabel(item, currency = 'XOF') {
    const variants = item.variant_labels
        ? item.variant_labels.join(', ')
        : Object.values(item.selected_variants || {}).filter(Boolean).join(', ')
    const variantSuffix = variants ? ` (${variants})` : ''
    const total = item.line_total != null
        ? item.line_total
        : ((item.unit_price || 0) * (item.quantity || 0))

    return `${item.product_name}${variantSuffix} x ${item.quantity} = ${formatPrice(total, currency)}`
}

function buildCartRecap(state, currency = 'XOF') {
    const cartItems = state.cart_items || []
    const total = cartItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
    const lines = cartItems.map(item => `- ${formatLineLabel(item, currency)}`)

    return [
        'Panier actuel :',
        '',
        ...lines,
        '',
        `Total : ${formatPrice(total, currency)}`,
        '',
        '1. Ajouter un article',
        '2. Supprimer un article',
        '3. Modifier la quantite',
        '4. Continuer',
    ].join('\n')
}

function buildCartDeleteMenu(state, currency = 'XOF') {
    const cartItems = state.cart_items || []
    const lines = cartItems.map((item, idx) => {
        const variants = Object.values(item.selected_variants || {}).filter(Boolean).join(', ')
        const label = variants ? `${item.product_name} (${variants}) x${item.quantity}` : `${item.product_name} x${item.quantity}`
        return `${idx + 1}. ${label}`
    })
    return ['Quel article souhaitez-vous supprimer ?', '', ...lines].join('\n')
}

function buildCartModifyMenu(state) {
    const cartItems = state.cart_items || []
    const lines = cartItems.map((item, idx) => {
        const variants = Object.values(item.selected_variants || {}).filter(Boolean).join(', ')
        const label = variants ? `${item.product_name} (${variants}) x${item.quantity}` : `${item.product_name} x${item.quantity}`
        return `${idx + 1}. ${label}`
    })
    return ['Quel article souhaitez-vous modifier ?', '', ...lines].join('\n')
}

function detectItemToDelete(text, cartItems) {
    const normalized = normalizeText(text).toLowerCase().trim()

    // Par numéro
    const num = parseInt(normalized)
    if (!isNaN(num) && num >= 1 && num <= cartItems.length) return num - 1

    // Par nom de produit ou variante
    for (let i = 0; i < cartItems.length; i++) {
        const item = cartItems[i]
        const name = (item.product_name || '').toLowerCase()
        if (normalized.includes(name) || name.includes(normalized)) return i
        const variants = Object.values(item.selected_variants || {}).filter(Boolean).map(v => String(v).toLowerCase())
        if (variants.some(v => normalized.includes(v) && normalized.includes(name.split(' ')[0]))) return i
    }

    return -1
}

function buildBatchCartReply(state, currency = 'XOF') {
    return buildCartRecap(state, currency)
}

function buildStructuredCartReply(state, products, capturedFields = [], currency = 'XOF') {
    const acknowledgement = buildCapturedSummary(capturedFields)

    if (state.stage === CART_STAGE.CART_RECAP) {
        return [acknowledgement, buildCartRecap(state, currency)].filter(Boolean).join('\n\n')
    }

    const product = findProductById(products, state.draft_item?.product_id)
    if (!product || !state.draft_item) return null

    const awaitingField = buildAwaitingField(product, state.draft_item, currency)
    if (!awaitingField) {
        return acknowledgement || null
    }

    return [acknowledgement, awaitingField.prompt].filter(Boolean).join(' ')
}

function detectProductForNewLine(text, products, state) {
    const detectedProduct = findBestProduct(products, text)
    if (detectedProduct) return detectedProduct

    if (wantsAnotherCombination(text)) {
        const lastLine = state.cart_items?.[state.cart_items.length - 1]
        if (!lastLine) return null
        return findProductById(products, lastLine.product_id)
    }

    return null
}

function messageLooksLikeCombinationDetails(product, text) {
    if (!product) return false

    if (extractQuantity(text)) return true

    const probe = extractVariantsFromText(product, text, createDraftItem(product))
    return probe.captured.length > 0
}

function resolveBatchProduct(products, state, text) {
    if (state.draft_item && !hasDraftSelections(state.draft_item)) {
        return findProductById(products, state.draft_item.product_id)
    }

    const detectedProduct = findBestProduct(products, text)
    if (detectedProduct) return detectedProduct

    const lastLine = state.cart_items?.[state.cart_items.length - 1]
    if (state.stage === CART_STAGE.CART_RECAP && lastLine) {
        return findProductById(products, lastLine.product_id)
    }

    return null
}

function buildVariantQuestion(product, partialItem, quantity, knownLabel) {
    const missingVars = getRequiredVariants(product)
        .filter(v => !getSelectedVariantValue(partialItem, v.id))
    const firstMissing = missingVars[0]
    if (!firstMissing) return null

    const opts = (firstMissing.options || []).map(o => getOptionValue(o)).filter(Boolean)
    const optsStr = opts.join(', ')
    const example = opts[0] || '?'
    const varLabel = getVariantLabel(firstMissing)
    const articleLabel = knownLabel && knownLabel !== '?' ? knownLabel : 'cet article'
    const quantityPrefix = quantity > 1 ? `les ${quantity} × ${articleLabel}` : `le ${articleLabel}`

    return `Quelle ${varLabel.toLowerCase()} pour ${quantityPrefix} ?\n(${optsStr} — répondez simplement ex : "${example}")`
}

function updateCartStateFromUserMessage(previousState, text, products = [], currency = 'XOF') {
    const state = cloneCartState(previousState)
    const normalized = normalizeText(text)
    const capturedFields = []
    let stateChanged = false
    let shouldBypassAI = false

    if (!normalized) {
        return { state, capturedFields, stateChanged, shouldBypassAI, directReply: null }
    }

    // Handler "plus [produit]" : afficher les combos overflow restants
    const plusMatch = normalized.match(/^plus\s+(.+)$/)
    if (plusMatch && state.awaiting_field?.overflow) {
        const productQuery = normalizeText(plusMatch[1])
        const overflow = state.awaiting_field.overflow
        const targetProduct = products.find(p => {
            const name = normalizeText(p.name)
            return name.includes(productQuery) || productQuery.includes(name.split(' ')[0])
        })
        if (targetProduct && overflow[targetProduct.id]?.length > 0) {
            const remaining = overflow[targetProduct.id]
            const lines = remaining.map(combo => {
                const label = resolveCombinationLabel(targetProduct, combo)
                const price = combo.price != null ? ` — ${formatPrice(combo.price, currency)}` : ''
                return `· ${label}${price}`
            }).join('\n')
            return {
                state, capturedFields,
                stateChanged: false, shouldBypassAI: true,
                directReply: `*${targetProduct.name}* — combinaisons restantes :\n${lines}`,
            }
        }
    }

    // Handler partial_combos : client répond aux quantités après "Combien de chaque ?"
    if (state.awaiting_field?.type === 'partial_combos') {
        const partialCombos = state.awaiting_field.partialCombos || []
        const comboLabels = state.awaiting_field.comboLabels || []
        const product = findProductById(products, state.draft_item?.product_id)

        if (product && partialCombos.length > 0) {
            // FIRST: tenter le batch parser — le client a peut-être re-spécifié avec variantes différentes
            // Ex: "3 noir m et 5 rouge xl" après stockage de Noire/L et Rouge/XL → utiliser les nouvelles variantes
            const batchAttempt = parseBatchCombinationLines(product, normalized)
            if (batchAttempt.status === 'success') {
                for (const line of batchAttempt.lines) {
                    state.cart_items = mergeOrAppendCartLine(state.cart_items, line)
                }
                state.draft_item = null
                state.stage = CART_STAGE.CART_RECAP
                state.awaiting_field = buildCartActionField()
                state.last_prompt_kind = CART_STAGE.CART_RECAP
                state.last_prompt_text = normalized
                return {
                    state, capturedFields,
                    stateChanged: true, shouldBypassAI: true,
                    directReply: buildBatchCartReply(state, currency),
                }
            }

            const quantities = (normalized.match(/\b\d{1,3}\b/g) || []).map(Number).filter(n => n > 0)

            if (quantities.length === partialCombos.length) {
                // N nombres pour N combos → construire les lignes directement
                const lines = []
                let buildError = null
                for (let i = 0; i < partialCombos.length; i++) {
                    const itemWithQty = { ...cloneItem(partialCombos[i]), quantity: quantities[i] }
                    const lineResult = buildLineFromDraft(product, itemWithQty, lines.length + 1)
                    if (lineResult.error) { buildError = lineResult.error; break }
                    lines.push(lineResult.line)
                }

                if (!buildError && lines.length > 0) {
                    for (const line of lines) {
                        state.cart_items = mergeOrAppendCartLine(state.cart_items, line)
                    }
                    state.draft_item = null
                    state.stage = CART_STAGE.CART_RECAP
                    state.awaiting_field = buildCartActionField()
                    state.last_prompt_kind = CART_STAGE.CART_RECAP
                    state.last_prompt_text = normalized
                    return {
                        state, capturedFields,
                        stateChanged: true, shouldBypassAI: true,
                        directReply: buildBatchCartReply(state, currency),
                    }
                }
            }

            if (quantities.length > 0 && quantities.length < partialCombos.length) {
                // Ambigu : moins de nombres que de combos → demander par combo
                const promptLines = comboLabels.map(label => `· ${label} : ?`).join('\n')
                return {
                    state, capturedFields,
                    stateChanged: false, shouldBypassAI: true,
                    directReply: `Précisez la quantité pour chaque :\n${promptLines}`,
                }
            }

            // Client re-spécifie tout avec quantités (ex: "3 noire s et 2 rose xxxl")
            // → reset pour laisser tomber dans le batch parse
            state.awaiting_field = null
            state.draft_item = createDraftItem(product)
        }
    }

    // Handler missing_variant_one_by_one : bot pose une question par variante manquante
    if (state.awaiting_field?.type === 'missing_variant_one_by_one') {
        const { product_id, queue, current_index, pending_lines } = state.awaiting_field
        const product = findProductById(products, product_id)

        if (product && queue && current_index < queue.length) {
            const current = queue[current_index]

            // Tenter d'extraire des variantes depuis la réponse du client
            const probe = extractVariantsFromText(product, normalized, cloneItem(current.item))
            const completedItem = probe.item
            const capturedSomething = probe.captured && probe.captured.length > 0

            if (hasAllRequiredVariants(product, completedItem)) {
                // Item 100% complet → construire la ligne de panier
                completedItem.quantity = current.quantity
                const lineResult = buildLineFromDraft(product, completedItem, 1)

                if (!lineResult.error) {
                    const newPendingLines = [...(pending_lines || []), lineResult.line]
                    const nextIndex = current_index + 1

                    if (nextIndex >= queue.length) {
                        // Tous les items complétés → récap final
                        for (const line of newPendingLines) {
                            state.cart_items = mergeOrAppendCartLine(state.cart_items, line)
                        }
                        state.draft_item = null
                        state.stage = CART_STAGE.CART_RECAP
                        state.awaiting_field = buildCartActionField()
                        state.last_prompt_kind = CART_STAGE.CART_RECAP
                        state.last_prompt_text = normalized
                        return {
                            state, capturedFields,
                            stateChanged: true, shouldBypassAI: true,
                            directReply: buildBatchCartReply(state, currency),
                        }
                    }

                    // Passer à l'item suivant
                    const next = queue[nextIndex]
                    state.awaiting_field = {
                        ...state.awaiting_field,
                        current_index: nextIndex,
                        pending_lines: newPendingLines,
                    }
                    const question = buildVariantQuestion(product, next.item, next.quantity, next.known_label)
                    return {
                        state, capturedFields,
                        stateChanged: true, shouldBypassAI: true,
                        directReply: question,
                    }
                }
            }

            // Item pas encore complet (il manque encore des variantes)
            // Si le client a fourni quelque chose de partiel → mettre à jour l'item dans la queue
            // pour ne pas re-demander ce qui a déjà été capturé
            const updatedQueue = [...queue]
            if (capturedSomething) {
                updatedQueue[current_index] = { ...current, item: completedItem }
                state.awaiting_field = { ...state.awaiting_field, queue: updatedQueue }
            }

            // Demander la prochaine variante manquante (sur l'item mis à jour)
            const itemForQuestion = capturedSomething ? completedItem : current.item
            const question = buildVariantQuestion(product, itemForQuestion, current.quantity, current.known_label)
            return {
                state, capturedFields,
                stateChanged: capturedSomething, shouldBypassAI: true,
                directReply: question,
            }
        }
    }

    // Handler multi_product_combos : réponse client "2 Robe Noire XL, 1 Veste Rose S"
    // Supporte aussi les réponses ligne par ligne ou message par message.
    if (state.awaiting_field?.type === 'multi_product_combos') {
        const productList = (state.awaiting_field.product_ids || [])
            .map(id => findProductById(products, id))
            .filter(Boolean)

        if (productList.length > 0) {
            const result = parseMultiProductBatchLines(productList, normalized)

            if (result.status === 'success' && result.lines.length > 0) {
                // Fusionner avec les lignes déjà collectées (messages précédents)
                const previousLines = state.awaiting_field.lines_collected || []
                const allLines = [...previousLines, ...result.lines]

                // Vérifier si tous les produits attendus sont couverts
                const coveredIds = new Set(allLines.map(l => l.product_id))
                const allCovered = (state.awaiting_field.product_ids || []).every(id => coveredIds.has(id))

                if (allCovered) {
                    for (const line of allLines) {
                        state.cart_items = mergeOrAppendCartLine(state.cart_items, line)
                    }
                    state.draft_item = null
                    state.stage = CART_STAGE.CART_RECAP
                    state.awaiting_field = buildCartActionField()
                    state.last_prompt_kind = CART_STAGE.CART_RECAP
                    state.last_prompt_text = normalized
                    return {
                        state, capturedFields,
                        stateChanged: true, shouldBypassAI: true,
                        directReply: buildBatchCartReply(state, currency),
                    }
                }

                // Pas encore complet : stocker et indiquer ce qui manque
                const missingNames = (state.awaiting_field.product_ids || [])
                    .filter(id => !coveredIds.has(id))
                    .map(id => findProductById(products, id))
                    .filter(Boolean)
                    .map(p => p.name)
                    .join(', ')

                state.awaiting_field = { ...state.awaiting_field, lines_collected: allLines }
                return {
                    state, capturedFields,
                    stateChanged: true, shouldBypassAI: true,
                    directReply: `Noté ! Il reste : ${missingNames}.\nPrécisez variante(s) + quantité pour cet article.`,
                }
            }

            if (result.status === 'missing_product') {
                return {
                    state, capturedFields,
                    stateChanged: false, shouldBypassAI: true,
                    directReply: `Je n'ai pas identifié le produit pour : "${result.segment}".\nPrécisez le nom de l'article (ex : "2 Robe Noire XL").`,
                }
            }

            if (result.status === 'missing_variants' && result.product) {
                const variantNames = getRequiredVariants(result.product)
                    .filter(v => !getSelectedVariantValue(createDraftItem(result.product), v.id))
                    .map(v => getVariantLabel(v).toLowerCase())
                    .join(', ')
                return {
                    state, capturedFields,
                    stateChanged: false, shouldBypassAI: true,
                    directReply: `Pour "${result.product.name}", précisez : ${variantNames || 'les variantes requises'} (ex : "2 ${result.product.name.split(' ')[0]} Noire L").`,
                }
            }
        }
    }

    const batchProduct = resolveBatchProduct(products, state, normalized)
    const canTryBatchParse = batchProduct && (!state.draft_item || !hasDraftSelections(state.draft_item))
    if (canTryBatchParse) {
        const batchParse = parseBatchCombinationLines(batchProduct, normalized)

        if (batchParse.status === 'success') {
            for (const line of batchParse.lines) {
                state.cart_items = mergeOrAppendCartLine(state.cart_items, line)
            }

            state.draft_item = null
            state.stage = CART_STAGE.CART_RECAP
            state.awaiting_field = buildCartActionField()
            state.last_prompt_kind = CART_STAGE.CART_RECAP
            state.last_prompt_text = normalized

            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: buildBatchCartReply(state, currency),
            }
        }

        if (batchParse.status === 'error') {
            return {
                state,
                capturedFields,
                stateChanged: false,
                shouldBypassAI: true,
                directReply: batchParse.error,
            }
        }

        if (batchParse.status === 'missing_variant_sequential') {
            // Variantes manquantes → poser une question par item, dans l'ordre
            const first = batchParse.queue[0]
            state.draft_item = createDraftItem(batchProduct)
            state.stage = CART_STAGE.COLLECTING_ITEM
            state.awaiting_field = {
                type: 'missing_variant_one_by_one',
                product_id: batchProduct.id,
                queue: batchParse.queue,
                current_index: 0,
                pending_lines: [],
            }
            const question = buildVariantQuestion(batchProduct, first.item, first.quantity, first.known_label)
            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: question,
            }
        }

        if (batchParse.status === 'missing_quantities') {
            // Variantes identifiées, quantités manquantes → stocker pour le tour suivant
            state.draft_item = createDraftItem(batchProduct)
            state.awaiting_field = {
                type: 'partial_combos',
                label: 'quantites_par_combo',
                partialCombos: batchParse.partialCombos,
                comboLabels: batchParse.comboLabels,
                prompt: batchParse.prompt,
            }
            state.stage = CART_STAGE.COLLECTING_ITEM
            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: batchParse.prompt,
            }
        }

        if (batchParse.status === 'invalid') {
            // Format ambigu : laisser l'IA guider le client naturellement
            // (ne pas bypasser avec un template rigide qui crée des boucles)
            return {
                state,
                capturedFields,
                stateChanged: false,
                shouldBypassAI: false,
                directReply: null,
            }
        }
    }

    // Scénario F : draft_item a une quantité totale annoncée, mais le client
    // donne des sous-quantités par variante (ex: "2 Noire S et 3 Rose S").
    // Vérifier que la somme des sous-quantités correspond à la quantité annoncée.
    if (!canTryBatchParse && state.draft_item?.quantity) {
        const draftProduct = findProductById(products, state.draft_item.product_id)
        if (draftProduct) {
            const batchParse = parseBatchCombinationLines(draftProduct, normalized)
            if (batchParse.status === 'success') {
                const announced = state.draft_item.quantity
                const batchTotal = batchParse.lines.reduce((sum, l) => sum + (l.quantity || 0), 0)

                if (batchTotal !== announced) {
                    return {
                        state,
                        capturedFields,
                        stateChanged: false,
                        shouldBypassAI: true,
                        directReply: `Vous avez mentionné ${announced} au total mais je compte ${batchTotal} dans vos choix. Merci de me préciser les quantités correctes.`,
                    }
                }

                // Somme cohérente : appliquer le batch
                for (const line of batchParse.lines) {
                    state.cart_items = mergeOrAppendCartLine(state.cart_items, line)
                }
                state.draft_item = null
                state.stage = CART_STAGE.CART_RECAP
                state.awaiting_field = buildCartActionField()
                state.last_prompt_kind = CART_STAGE.CART_RECAP
                state.last_prompt_text = normalized

                return {
                    state,
                    capturedFields,
                    stateChanged: true,
                    shouldBypassAI: true,
                    directReply: buildBatchCartReply(state, currency),
                }
            }
        }
    }

    if (state.awaiting_field?.type === 'optional_variant' && isNegativeReply(normalized) && state.draft_item) {
        state.draft_item.skipped_optional_variant_ids = Array.from(new Set([
            ...(state.draft_item.skipped_optional_variant_ids || []),
            state.awaiting_field.variant_id,
        ]))
        state.awaiting_field = buildAwaitingField(findProductById(products, state.draft_item.product_id), state.draft_item, currency)
        state.last_prompt_kind = state.awaiting_field ? CART_STAGE.COLLECTING_ITEM : CART_STAGE.CART_RECAP
        state.last_prompt_text = normalized
        state.stage = state.awaiting_field ? CART_STAGE.COLLECTING_ITEM : CART_STAGE.CART_RECAP

        return {
            state,
            capturedFields,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: buildStructuredCartReply(state, products, [], currency),
        }
    }

    if (state.stage === CART_STAGE.CART_RECAP) {
        // Sub-état suppression
        if (state.awaiting_field?.type === 'cart_delete') {
            const itemIndex = detectItemToDelete(normalized, state.cart_items || [])
            if (itemIndex >= 0) {
                state.cart_items = (state.cart_items || []).filter((_, i) => i !== itemIndex)
                if (!state.cart_items.length) {
                    state.stage = CART_STAGE.IDLE
                    state.awaiting_field = null
                    return { state, capturedFields, stateChanged: true, shouldBypassAI: true, directReply: 'Votre panier est vide. Quel article vous interesse ?' }
                }
                state.awaiting_field = buildCartActionField()
                return { state, capturedFields, stateChanged: true, shouldBypassAI: true, directReply: buildCartRecap(state, currency) }
            }
            return { state, capturedFields, stateChanged: false, shouldBypassAI: true, directReply: buildCartDeleteMenu(state, currency) }
        }

        // Sub-état modification quantité — étape 1 : sélection article
        if (state.awaiting_field?.type === 'cart_modify') {
            const itemIndex = detectItemToDelete(normalized, state.cart_items || [])
            if (itemIndex >= 0) {
                state.awaiting_field = { type: 'cart_modify_qty', label: 'nouvelle quantite', item_index: itemIndex }
                const item = state.cart_items[itemIndex]
                const variants = Object.values(item.selected_variants || {}).filter(Boolean).join(', ')
                const label = variants ? `${item.product_name} (${variants})` : item.product_name
                return { state, capturedFields, stateChanged: true, shouldBypassAI: true, directReply: `Quelle quantite pour ${label} ? (actuellement : ${item.quantity})` }
            }
            return { state, capturedFields, stateChanged: false, shouldBypassAI: true, directReply: buildCartModifyMenu(state) }
        }

        // Sub-état modification quantité — étape 2 : saisie quantité
        if (state.awaiting_field?.type === 'cart_modify_qty') {
            const newQty = extractQuantity(normalized)
            const itemIndex = state.awaiting_field.item_index
            if (newQty && newQty > 0 && itemIndex >= 0 && itemIndex < (state.cart_items || []).length) {
                const item = state.cart_items[itemIndex]
                const unitPrice = item.unit_price_fcfa || (item.line_total / item.quantity) || 0
                state.cart_items[itemIndex] = { ...item, quantity: newQty, line_total: unitPrice * newQty }
                state.awaiting_field = buildCartActionField()
                return { state, capturedFields, stateChanged: true, shouldBypassAI: true, directReply: buildCartRecap(state, currency) }
            }
            return { state, capturedFields, stateChanged: false, shouldBypassAI: true, directReply: 'Quelle quantite souhaitez-vous ? (entrez un nombre)' }
        }

        // Menu numéroté
        if (normalized === '2' || /^(supprimer|retirer|enlever)/i.test(normalized)) {
            state.awaiting_field = { type: 'cart_delete', label: 'suppression article' }
            return { state, capturedFields, stateChanged: true, shouldBypassAI: true, directReply: buildCartDeleteMenu(state, currency) }
        }

        if (normalized === '3' || /^(modifier|changer|changer la quantit)/i.test(normalized)) {
            state.awaiting_field = { type: 'cart_modify', label: 'modification quantite' }
            return { state, capturedFields, stateChanged: true, shouldBypassAI: true, directReply: buildCartModifyMenu(state) }
        }

        if (normalized === '4' || /^(continuer|terminer|valider)/i.test(normalized)) {
            state.stage = CART_STAGE.CHECKOUT
            state.awaiting_field = null
            state.last_prompt_kind = CART_STAGE.CHECKOUT
            state.last_prompt_text = normalized
            return { state, capturedFields, stateChanged: true, shouldBypassAI: false, directReply: null }
        }

        // Sub-état ajout article
        if (state.awaiting_field?.type === 'adding_article') {
            const productToAdd = detectProductForNewLine(normalized, products, state)
            if (productToAdd) {
                state.draft_item = createDraftItem(productToAdd)
                state.stage = CART_STAGE.COLLECTING_ITEM
                state.awaiting_field = buildAwaitingField(productToAdd, state.draft_item, currency)
                state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
                state.last_prompt_text = normalized
                return {
                    state, capturedFields, stateChanged: true, shouldBypassAI: true,
                    directReply: buildStructuredCartReply(state, products, capturedFields, currency),
                }
            }
            // Produit non reconnu → re-demander
            return { state, capturedFields, stateChanged: false, shouldBypassAI: true, directReply: 'Je n\'ai pas reconnu cet article. Lequel souhaitez-vous ajouter ?' }
        }

        if (normalized === '1') {
            state.awaiting_field = { type: 'adding_article', label: 'ajout article' }
            return { state, capturedFields, stateChanged: true, shouldBypassAI: true, directReply: 'Quel article souhaitez-vous ajouter ?' }
        }

        let productForNewLine = detectProductForNewLine(normalized, products, state)
        if (!productForNewLine) {
            const lastLine = state.cart_items?.[state.cart_items.length - 1]
            const lastProduct = lastLine ? findProductById(products, lastLine.product_id) : null
            if (messageLooksLikeCombinationDetails(lastProduct, normalized)) {
                productForNewLine = lastProduct
            }
        }

        if (productForNewLine) {
            state.draft_item = createDraftItem(productForNewLine)
            state.stage = CART_STAGE.COLLECTING_ITEM
            state.awaiting_field = buildAwaitingField(productForNewLine, state.draft_item, currency)
            state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
            state.last_prompt_text = normalized
            stateChanged = true
        }

        if (!productForNewLine && isPositiveReply(normalized)) {
            state.stage = CART_STAGE.CHECKOUT
            state.awaiting_field = null
            state.last_prompt_kind = CART_STAGE.CHECKOUT
            state.last_prompt_text = normalized
            return { state, capturedFields, stateChanged: true, shouldBypassAI: false, directReply: null }
        }

        if (!productForNewLine && isNegativeReply(normalized)) {
            // "non" = pas d'article à ajouter → passer au checkout
            state.stage = CART_STAGE.CHECKOUT
            state.awaiting_field = null
            state.last_prompt_kind = CART_STAGE.CHECKOUT
            state.last_prompt_text = normalized
            return { state, capturedFields, stateChanged: true, shouldBypassAI: false, directReply: null }
        }
    }

    // En stage CHECKOUT sans draft_item : ne pas détecter de nouveau produit, laisser le checkout gérer
    if (state.stage === CART_STAGE.CHECKOUT && !state.draft_item) {
        return { state, capturedFields, stateChanged, shouldBypassAI: false, directReply: null }
    }

    // Détection multi-produits (ex: "robe et veste") — uniquement si panier vide
    if (!state.draft_item && !(state.cart_items?.length > 0)) {
        const multiProducts = detectMultipleProducts(normalized, products)
        if (multiProducts.length >= 2) {
            const { prompt, overflow } = buildMultiProductPrompt(multiProducts, currency)
            state.stage = CART_STAGE.COLLECTING_ITEM
            state.awaiting_field = {
                type: 'multi_product_combos',
                product_ids: multiProducts.map(p => p.id),
                overflow,
            }
            state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
            state.last_prompt_text = normalized
            return {
                state, capturedFields,
                stateChanged: true, shouldBypassAI: true,
                directReply: prompt,
            }
        }
    }

    if (!state.draft_item) {
        const detectedProduct = findBestProduct(products, normalized)
        if (detectedProduct) {
            state.draft_item = createDraftItem(detectedProduct)
            state.stage = CART_STAGE.COLLECTING_ITEM
            state.awaiting_field = buildAwaitingField(detectedProduct, state.draft_item, currency)
            state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
            state.last_prompt_text = normalized
            stateChanged = true

            // Sélection par numéro pur (ex: "1", "2") → retourner immédiatement
            // pour ne pas interpréter ce même chiffre comme une quantité
            if (/^\d+$/.test(normalized.trim())) {
                return {
                    state, capturedFields,
                    stateChanged: true, shouldBypassAI: true,
                    directReply: buildStructuredCartReply(state, products, [], currency),
                }
            }
        }
    } else if (!hasDraftSelections(state.draft_item)) {
        // draft_item pré-inféré sans aucune sélection : si le client confirme ce produit → bypass AI
        // (ex: bot a montré catalogue 1 produit → client dit "veste" → stateChanged=false sinon)
        const existingProduct = findProductById(products, state.draft_item.product_id)
        if (existingProduct && findBestProduct([existingProduct], normalized)) {
            stateChanged = true
        }
    }

    const product = findProductById(products, state.draft_item?.product_id)
    if (!product || !state.draft_item) {
        return { state, capturedFields, stateChanged, shouldBypassAI: false, directReply: null }
    }

    const previousAwaiting = cloneAwaitingField(state.awaiting_field)
    const quantity = extractQuantity(normalized)
    if (!state.draft_item.quantity && quantity) {
        state.draft_item.quantity = quantity
        capturedFields.push({ type: 'quantity', value: quantity })
        stateChanged = true
    }

    const variantCapture = extractVariantsFromText(product, normalized, state.draft_item)
    state.draft_item = variantCapture.item
    if (variantCapture.captured.length > 0) {
        capturedFields.push(...variantCapture.captured)
        stateChanged = true
    }

    state.awaiting_field = buildAwaitingField(product, state.draft_item, currency)
    state.last_prompt_kind = state.awaiting_field ? CART_STAGE.COLLECTING_ITEM : CART_STAGE.CART_RECAP
    state.last_prompt_text = normalized

    if (!state.awaiting_field && state.draft_item.quantity) {
        const lineResult = buildLineFromDraft(product, state.draft_item, state.cart_items.length + 1)
        if (lineResult.error) {
            return {
                state,
                capturedFields,
                stateChanged,
                shouldBypassAI: true,
                directReply: lineResult.error,
            }
        }

        state.cart_items = mergeOrAppendCartLine(state.cart_items, lineResult.line)
        state.draft_item = null
        state.stage = CART_STAGE.CART_RECAP
        state.awaiting_field = buildCartActionField()
        shouldBypassAI = true

        return {
            state,
            capturedFields,
            stateChanged: true,
            shouldBypassAI,
            directReply: buildStructuredCartReply(state, products, capturedFields, currency),
        }
    }

    if (capturedFields.length > 0 || stateChanged) {
        state.stage = CART_STAGE.COLLECTING_ITEM
        shouldBypassAI = true
    }

    const directReply = shouldBypassAI
        ? buildStructuredCartReply(state, products, capturedFields, currency)
        : null

    const awaitingChanged = JSON.stringify(previousAwaiting) !== JSON.stringify(state.awaiting_field)

    return {
        state,
        capturedFields,
        stateChanged: stateChanged || awaitingChanged,
        shouldBypassAI,
        directReply,
    }
}

function inferCartStateFromAssistantMessage(content, previousState, products = []) {
    const text = normalizeText(content)
    const state = cloneCartState(previousState)

    if (!text) return state

    if (/commande confirmee|commande creee|lien de paiement securise|lien de paiement|commande valid[ée]e/i.test(text)) {
        return cloneCartState({})
    }

    if (/nom complet|numero de telephone|adresse de livraison|telephone \(avec indicatif\)|adresse email/i.test(text)) {
        state.stage = CART_STAGE.CHECKOUT
        state.awaiting_field = null
        state.last_prompt_kind = CART_STAGE.CHECKOUT
        state.last_prompt_text = content
        return state
    }

    if (state.stage === CART_STAGE.CART_RECAP) {
        return state
    }

    // Ne pas inférer si le message mentionne plusieurs produits (catalogue)
    const matchingProductsCount = (products || []).filter(p => {
        const productName = normalizeText(p.name)
        if (!productName) return false
        if (text === productName) return true
        if (text.includes(productName) || productName.includes(text)) return true
        const terms = text.split(' ').filter(t => t.length > 2)
        return terms.filter(t => productName.includes(t)).length * 15 >= 30
    }).length

    const detectedProduct = matchingProductsCount === 1 ? findBestProduct(products, text) : null
    if (detectedProduct && !state.draft_item) {
        state.draft_item = createDraftItem(detectedProduct)
        state.stage = CART_STAGE.COLLECTING_ITEM
        state.awaiting_field = buildAwaitingField(detectedProduct, state.draft_item, currency)
        state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
        state.last_prompt_text = content
    }

    return state
}

function buildCartStateGuidance(cartState, products = []) {
    const state = cloneCartState(cartState)

    if ((!state.cart_items || state.cart_items.length === 0) && !state.draft_item) return ''

    const lines = ['PANIER STRUCTURE (source systeme, prioritaire):']

    if (state.cart_items.length > 0) {
        lines.push(`- Lignes deja validees: ${state.cart_items.length}`)
        state.cart_items.forEach((item, index) => {
            lines.push(`- Ligne ${index + 1}: ${formatLineLabel(item)}`)
        })
    }

    if (state.draft_item) {
        const product = findProductById(products, state.draft_item.product_id)
        lines.push(`- Ligne en cours: ${state.draft_item.product_name}`)

        if (state.draft_item.quantity) {
            lines.push(`- Quantite deja validee: ${state.draft_item.quantity}`)
        } else {
            lines.push('- Quantite encore manquante')
        }

        const selectedVariants = Object.entries(state.draft_item.selected_variants || {})
        if (selectedVariants.length > 0) {
            lines.push(`- Variantes deja collectees: ${selectedVariants.map(([label, value]) => `${label}=${value}`).join(', ')}`)
        }

        const optionalVariants = product
            ? getOptionalVariants(product)
                .filter(variant => getSelectedVariantValue(state.draft_item, variant.id))
                .map(variant => `${variant.label}=${getSelectedVariantValue(state.draft_item, variant.id)}`)
            : []

        if (optionalVariants.length > 0) {
            lines.push(`- Options/supplements deja collectes: ${optionalVariants.join(', ')}`)
        }
    }

    if (state.awaiting_field?.label) {
        lines.push(`- Champ bloquant actuel: ${state.awaiting_field.label}`)
    }

    lines.push('- Si le client donne une information hors ordre (ex: couleur avant quantite), memorise-la mais redemande le champ bloquant.')
    lines.push('- Interdiction de supposer une quantite par defaut.')

    if (state.stage === CART_STAGE.CART_RECAP) {
        lines.push('- Le panier contient deja une ou plusieurs lignes validees. Demande seulement si le client veut ajouter un autre article.')
    }

    if (state.stage === CART_STAGE.CHECKOUT) {
        lines.push('- Le panier produit est deja verrouille. Ne redemande ni quantite ni variantes. Passe uniquement aux informations client.')
    }

    return lines.join('\n')
}

function mergeCartStateIntoToolArgs(functionName, args = {}, cartState = {}) {
    if (functionName !== 'create_order') return args

    const state = cloneCartState(cartState)

    const cartItems = (state.cart_items || [])
        .filter(item => item?.product_name && item?.quantity)
        .map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            selected_variants: { ...(item.selected_variants || {}) },
        }))

    if (cartItems.length > 0) {
        return {
            ...args,
            items: cartItems,
        }
    }

    const draftItem = state.draft_item
    if (!draftItem || !draftItem.product_name || !draftItem.quantity) return args

    const structuredItem = {
        product_name: draftItem.product_name,
        quantity: draftItem.quantity,
        selected_variants: { ...(draftItem.selected_variants || {}) },
    }

    if (!Array.isArray(args.items) || args.items.length === 0) {
        return {
            ...args,
            items: [structuredItem]
        }
    }

    if (args.items.length === 1) {
        const existingItem = args.items[0] || {}
        return {
            ...args,
            items: [{
                ...existingItem,
                product_name: existingItem.product_name || structuredItem.product_name,
                quantity: existingItem.quantity || structuredItem.quantity,
                selected_variants: {
                    ...structuredItem.selected_variants,
                    ...(existingItem.selected_variants || {})
                }
            }]
        }
    }

    return args
}

function resetCartToRecap(state, currency = 'XOF') {
    const newState = {
        ...state,
        stage: CART_STAGE.CART_RECAP,
        awaiting_field: buildCartActionField(),
        last_prompt_kind: CART_STAGE.CART_RECAP,
        draft_item: null,
    }
    return {
        state: newState,
        directReply: buildCartRecap(newState, currency),
    }
}

module.exports = {
    CART_STAGE,
    buildCartStateGuidance,
    clearCartState,
    getCartState,
    inferCartStateFromAssistantMessage,
    mergeCartStateIntoToolArgs,
    resetCartToRecap,
    setCartState,
    updateCartStateFromUserMessage,
}
