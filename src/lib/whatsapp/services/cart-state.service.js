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
    size: 10,
    weight: 20,
    version: 30,
    format: 40,
    visual: 50,
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
        prompt: 'Souhaitez-vous ajouter un autre article ou continuer ?'
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
            return { item: cloneItem(draftItem), captured: [], multiValue: true }
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
    const normalized = normalizeText(text)
    if (!normalized) return []

    return normalized
        .split(/\s+(?:et|puis|\+)\s+|[;,]\s*|\n+\s*/)
        .map(segment => segment.trim())
        .filter(Boolean)
}

function hasAllRequiredVariants(product, item) {
    return getRequiredVariants(product).every(variant => !!getSelectedVariantValue(item, variant.id))
}

function parseBatchCombinationLines(product, text) {
    const segments = splitCombinationSegments(text)
    if (segments.length < 2) {
        return { status: 'not_batch', lines: [], segments: [] }
    }

    const lines = []
    const partialCombos = [] // combos complets en variantes mais sans quantité

    for (const segment of segments) {
        const draftItem = createDraftItem(product)
        const quantity = extractQuantity(segment)

        if (!quantity) {
            // Pas de quantité : vérifier si les variantes sont complètes (combos sans qty)
            const variantCapture = extractVariantsFromText(product, segment, draftItem)
            if (hasAllRequiredVariants(product, variantCapture.item)) {
                partialCombos.push(variantCapture.item)
                continue
            }
            return { status: 'invalid', lines: [], segments }
        }

        draftItem.quantity = quantity
        const variantCapture = extractVariantsFromText(product, segment, draftItem)
        const completedItem = variantCapture.item

        if (!hasAllRequiredVariants(product, completedItem)) {
            return { status: 'invalid', lines: [], segments }
        }

        const lineResult = buildLineFromDraft(product, completedItem, lines.length + 1)
        if (lineResult.error) {
            return { status: 'error', error: lineResult.error, lines: [], segments }
        }

        lines.push(lineResult.line)
    }

    // Tous les segments avaient des variantes complètes mais aucune quantité
    if (partialCombos.length > 0 && lines.length === 0) {
        const comboLabels = partialCombos.map(item =>
            Object.values(item.selected_variants || {}).filter(Boolean).join(' / ')
        ).filter(Boolean)
        return {
            status: 'missing_quantities',
            partialCombos,
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

function hasPricedCombinations(product) {
    const combos = (product.combinations || []).filter(c => c.available !== false)
    if (combos.length < 2) return false
    const prices = combos.map(c => c.price).filter(p => p != null)
    return prices.length > 0 && new Set(prices).size > 1
}

function buildAwaitingField(product, item) {
    if (!item) return null

    const requiredVariants = getRequiredVariants(product)
    const allVariantsMissing = requiredVariants.length > 0 &&
        requiredVariants.every(v => !getSelectedVariantValue(item, v.id))

    // Début de collecte : aucune variante ni quantité — présenter tout en un seul message
    if (!item.quantity && allVariantsMissing) {
        if (hasPricedCombinations(product)) {
            const available = (product.combinations || []).filter(c => c.available !== false)
            const lines = available.slice(0, 10).map(combo => {
                const label = resolveCombinationLabel(product, combo)
                const price = combo.price != null
                    ? ` — ${Number(combo.price).toLocaleString('fr-FR')} FCFA`
                    : ''
                return `· ${label}${price}`
            })
            if (available.length > 10) lines.push(`· ... et ${available.length - 10} autre(s).`)
            return {
                type: 'quantity',
                label: 'choix_et_quantite',
                prompt: `Voici les choix disponibles pour ${product.name} :\n${lines.join('\n')}\nLequel souhaitez-vous et en quelle quantité ?`
            }
        }

        if (requiredVariants.length > 0) {
            const groups = requiredVariants.map(variant => {
                const label = getVariantLabel(variant)
                const opts = (variant.options || []).map(o => getOptionValue(o)).filter(Boolean).join(', ')
                return `${label}s : ${opts}`
            })
            const variantLabels = requiredVariants.map(v => getVariantLabel(v).toLowerCase() + 's')
            const intro = `Voici les ${variantLabels.join(' et ')} disponibles :`
            const question = `Quelle ${requiredVariants.map(v => getVariantLabel(v).toLowerCase()).join(', ')} et quantité souhaitez-vous ?`
            return {
                type: 'quantity',
                label: 'variantes_et_quantite',
                prompt: `${intro}\n${groups.join('\n')}\n${question}`
            }
        }
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
        if (entry.type === 'quantity') return `la quantite ${entry.value}`
        return `${entry.label.toLowerCase()} ${entry.value}`
    })

    if (parts.length === 1) return `Je note ${parts[0]}.`
    if (parts.length === 2) return `Je note ${parts[0]} et ${parts[1]}.`
    return `Je note ${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}.`
}

function buildLineFromDraft(product, draftItem, index = 1) {
    const selectedVariantsMap = { ...(draftItem.selected_variants || {}) }
    const pricing = calculateItemPrice(product, selectedVariantsMap, draftItem.product_name, draftItem.quantity)
    if (pricing.error) {
        return { error: pricing.error }
    }

    const unitPrice = pricing.price || product.price_fcfa || 0
    const lineTotal = unitPrice * draftItem.quantity

    return {
        line: {
            ...cloneItem(draftItem),
            line_id: `line_${Date.now()}_${index}`,
            unit_price: unitPrice,
            line_total: lineTotal,
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

function formatLineLabel(item) {
    const variants = Object.values(item.selected_variants || {}).filter(Boolean).join(', ')
    const variantSuffix = variants ? ` (${variants})` : ''
    const total = item.line_total != null
        ? item.line_total
        : ((item.unit_price || 0) * (item.quantity || 0))

    return `${item.product_name}${variantSuffix} x ${item.quantity} = ${total.toLocaleString('fr-FR')} FCFA`
}

function buildCartRecap(state) {
    const cartItems = state.cart_items || []
    const total = cartItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
    const lines = cartItems.map(item => `- ${formatLineLabel(item)}`)

    return [
        'Panier actuel :',
        '',
        ...lines,
        '',
        `Total : ${total.toLocaleString('fr-FR')} FCFA`,
        '',
        'Souhaitez-vous ajouter un autre article ou continuer ?'
    ].join('\n')
}

function buildBatchCartReply(state, addedLines = []) {
    const intro = addedLines.length > 0
        ? [
            'Je note ces lignes :',
            '',
            ...addedLines.map(item => `- ${formatLineLabel(item)}`)
        ].join('\n')
        : null

    return [intro, buildCartRecap(state)].filter(Boolean).join('\n\n')
}

function buildStructuredCartReply(state, products, capturedFields = [], options = {}) {
    const acknowledgement = buildCapturedSummary(capturedFields)

    if (state.stage === CART_STAGE.CART_RECAP) {
        const intro = options.lineAdded
            ? `Je note cette ligne :\n- ${formatLineLabel(options.lineAdded)}`
            : null
        return [acknowledgement, intro, buildCartRecap(state)].filter(Boolean).join('\n\n')
    }

    const product = findProductById(products, state.draft_item?.product_id)
    if (!product || !state.draft_item) return null

    const awaitingField = buildAwaitingField(product, state.draft_item)
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

function updateCartStateFromUserMessage(previousState, text, products = []) {
    const state = cloneCartState(previousState)
    const normalized = normalizeText(text)
    const capturedFields = []
    let stateChanged = false
    let shouldBypassAI = false

    if (!normalized) {
        return { state, capturedFields, stateChanged, shouldBypassAI, directReply: null }
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
                directReply: buildBatchCartReply(state, batchParse.lines),
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

        if (batchParse.status === 'missing_quantities') {
            // Variantes identifiées, quantités manquantes → prompt structuré
            return {
                state,
                capturedFields,
                stateChanged: false,
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
                    directReply: buildBatchCartReply(state, batchParse.lines),
                }
            }
        }
    }

    if (state.awaiting_field?.type === 'optional_variant' && isNegativeReply(normalized) && state.draft_item) {
        state.draft_item.skipped_optional_variant_ids = Array.from(new Set([
            ...(state.draft_item.skipped_optional_variant_ids || []),
            state.awaiting_field.variant_id,
        ]))
        state.awaiting_field = buildAwaitingField(findProductById(products, state.draft_item.product_id), state.draft_item)
        state.last_prompt_kind = state.awaiting_field ? CART_STAGE.COLLECTING_ITEM : CART_STAGE.CART_RECAP
        state.last_prompt_text = normalized
        state.stage = state.awaiting_field ? CART_STAGE.COLLECTING_ITEM : CART_STAGE.CART_RECAP

        return {
            state,
            capturedFields,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: buildStructuredCartReply(state, products, []),
        }
    }

    if (state.stage === CART_STAGE.CART_RECAP) {
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
            state.awaiting_field = buildAwaitingField(productForNewLine, state.draft_item)
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
            return {
                state,
                capturedFields,
                stateChanged: false,
                shouldBypassAI: true,
                directReply: 'D accord. Dites-moi quel article vous souhaitez ajouter ou modifier.',
            }
        }
    }

    if (!state.draft_item) {
        const detectedProduct = findBestProduct(products, normalized)
        if (detectedProduct) {
            state.draft_item = createDraftItem(detectedProduct)
            state.stage = CART_STAGE.COLLECTING_ITEM
            state.awaiting_field = buildAwaitingField(detectedProduct, state.draft_item)
            state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
            state.last_prompt_text = normalized
            stateChanged = true
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

    state.awaiting_field = buildAwaitingField(product, state.draft_item)
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
            directReply: buildStructuredCartReply(state, products, capturedFields, { lineAdded: lineResult.line }),
        }
    }

    if (capturedFields.length > 0 || stateChanged) {
        state.stage = CART_STAGE.COLLECTING_ITEM
        shouldBypassAI = true
    }

    const directReply = shouldBypassAI
        ? buildStructuredCartReply(state, products, capturedFields)
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
        state.awaiting_field = buildAwaitingField(detectedProduct, state.draft_item)
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
        lines.push('- Le panier contient deja une ou plusieurs lignes validees. Demande seulement si le client veut ajouter un autre article ou continuer.')
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

module.exports = {
    CART_STAGE,
    buildCartStateGuidance,
    clearCartState,
    getCartState,
    inferCartStateFromAssistantMessage,
    mergeCartStateIntoToolArgs,
    setCartState,
    updateCartStateFromUserMessage,
}
