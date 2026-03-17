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

function cloneAwaitingField(field = null) {
    if (!field) return null
    return { ...field }
}

function cloneCartState(cart = {}) {
    return {
        stage: cart.stage || CART_STAGE.IDLE,
        current_item: cloneItem(cart.current_item),
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

    const exact = variant.options.find(option => normalizeText(getOptionValue(option)) === normalizedText)
    if (exact) return exact

    return variant.options.find(option => {
        const normalizedValue = normalizeText(getOptionValue(option))
        if (!normalizedValue || normalizedValue.length < 2) return false
        return ` ${normalizedText} `.includes(` ${normalizedValue} `)
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

function extractVariantsFromText(product, text, currentItem) {
    const normalized = normalizeText(text)
    const captured = []
    const nextItem = cloneItem(currentItem)

    if (!product || !normalized) {
        return { item: nextItem, captured }
    }

    for (const variant of getCollectibleVariants(product)) {
        if (getSelectedVariantValue(nextItem, variant.id)) continue

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

function buildAwaitingField(product, item) {
    if (!item) return null

    if (!item.quantity) {
        return {
            type: 'quantity',
            label: 'quantite',
            prompt: 'Combien souhaitez-vous en commander ?'
        }
    }

    for (const variant of getRequiredVariants(product)) {
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

function formatVariantsForRecap(product, item) {
    if (!product || !item) return ''

    const orderedValues = [
        ...getRequiredVariants(product),
        ...getOptionalVariants(product),
    ]
        .map(variant => getSelectedVariantValue(item, variant.id))
        .filter(Boolean)

    return orderedValues.join(', ')
}

function buildMiniRecap(product, item) {
    const selectedVariantsMap = { ...(item.selected_variants || {}) }
    const pricing = calculateItemPrice(product, selectedVariantsMap, item.product_name, item.quantity)
    const unitPrice = pricing.price || product.price_fcfa || 0
    const total = unitPrice * item.quantity
    const variantSuffix = formatVariantsForRecap(product, item)
    const variantText = variantSuffix ? ` (${variantSuffix})` : ''

    return `Voici votre commande :\n\n• ${item.product_name}${variantText} x ${item.quantity} = ${total.toLocaleString('fr-FR')} FCFA.\n\nOn continue ?`
}

function buildStructuredCartReply(state, products, capturedFields = []) {
    const product = findProductById(products, state.current_item?.product_id)
    if (!product || !state.current_item) return null

    if (state.stage === CART_STAGE.CART_RECAP) {
        return buildMiniRecap(product, state.current_item)
    }

    const awaitingField = buildAwaitingField(product, state.current_item)
    if (!awaitingField) {
        return buildMiniRecap(product, state.current_item)
    }

    const acknowledgement = buildCapturedSummary(capturedFields)
    return [acknowledgement, awaitingField.prompt].filter(Boolean).join(' ')
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

    if (state.awaiting_field?.type === 'optional_variant' && isNegativeReply(normalized) && state.current_item) {
        state.current_item.skipped_optional_variant_ids = Array.from(new Set([
            ...(state.current_item.skipped_optional_variant_ids || []),
            state.awaiting_field.variant_id,
        ]))
        state.awaiting_field = buildAwaitingField(findProductById(products, state.current_item.product_id), state.current_item)
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
        if (isPositiveReply(normalized)) {
            state.stage = CART_STAGE.CHECKOUT
            state.awaiting_field = null
            state.last_prompt_kind = CART_STAGE.CHECKOUT
            state.last_prompt_text = normalized
            return { state, capturedFields, stateChanged: true, shouldBypassAI: false, directReply: null }
        }

        if (isNegativeReply(normalized)) {
            state.stage = CART_STAGE.COLLECTING_ITEM
            state.awaiting_field = buildAwaitingField(findProductById(products, state.current_item?.product_id), state.current_item)
            state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
            state.last_prompt_text = normalized
            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: 'D’accord. Dites-moi ce que vous souhaitez modifier sur cet article : quantite, taille, couleur ou autre variante.'
            }
        }
    }

    if (!state.current_item) {
        const detectedProduct = findBestProduct(products, normalized)
        if (detectedProduct) {
            state.current_item = {
                product_id: detectedProduct.id,
                product_name: detectedProduct.name,
                quantity: null,
                selected_variants: {},
                selected_variants_by_id: {},
                skipped_optional_variant_ids: [],
            }
            state.stage = CART_STAGE.COLLECTING_ITEM
            state.awaiting_field = buildAwaitingField(detectedProduct, state.current_item)
            state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
            state.last_prompt_text = normalized
            stateChanged = true
        }
    }

    const product = findProductById(products, state.current_item?.product_id)
    if (!product || !state.current_item) {
        return { state, capturedFields, stateChanged, shouldBypassAI: false, directReply: null }
    }

    const previousAwaiting = cloneAwaitingField(state.awaiting_field)
    const quantity = extractQuantity(normalized)
    if (!state.current_item.quantity && quantity) {
        state.current_item.quantity = quantity
        capturedFields.push({ type: 'quantity', value: quantity })
        stateChanged = true
    }

    const variantCapture = extractVariantsFromText(product, normalized, state.current_item)
    state.current_item = variantCapture.item
    if (variantCapture.captured.length > 0) {
        capturedFields.push(...variantCapture.captured)
        stateChanged = true
    }

    state.awaiting_field = buildAwaitingField(product, state.current_item)
    state.last_prompt_kind = state.awaiting_field ? CART_STAGE.COLLECTING_ITEM : CART_STAGE.CART_RECAP
    state.last_prompt_text = normalized

    if (!state.awaiting_field && state.current_item.quantity) {
        state.stage = CART_STAGE.CART_RECAP
        shouldBypassAI = capturedFields.length > 0
    } else if (capturedFields.length > 0) {
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

    if (/nom complet|numero de telephone|adresse de livraison|telephone \(avec indicatif\)/i.test(text)) {
        state.stage = CART_STAGE.CHECKOUT
        state.awaiting_field = null
        state.last_prompt_kind = CART_STAGE.CHECKOUT
        state.last_prompt_text = content
        return state
    }

    const detectedProduct = findBestProduct(products, text)
    if (detectedProduct && !state.current_item) {
        state.current_item = {
            product_id: detectedProduct.id,
            product_name: detectedProduct.name,
            quantity: null,
            selected_variants: {},
            selected_variants_by_id: {},
            skipped_optional_variant_ids: [],
        }
    }

    const product = findProductById(products, state.current_item?.product_id)
    if (!product || !state.current_item) {
        return state
    }

    if (/on continue \?/i.test(content)) {
        state.stage = CART_STAGE.CART_RECAP
        state.awaiting_field = null
        state.last_prompt_kind = CART_STAGE.CART_RECAP
        state.last_prompt_text = content
        return state
    }

    if (/combien souhaitez-vous/i.test(content)) {
        state.stage = CART_STAGE.COLLECTING_ITEM
        state.awaiting_field = buildAwaitingField(product, { ...state.current_item, quantity: null })
        state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
        state.last_prompt_text = content
        return state
    }

    const awaitingField = buildAwaitingField(product, state.current_item)
    if (awaitingField) {
        state.stage = CART_STAGE.COLLECTING_ITEM
        state.awaiting_field = awaitingField
        state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
        state.last_prompt_text = content
    }

    return state
}

function buildCartStateGuidance(cartState, products = []) {
    const state = cloneCartState(cartState)
    const product = findProductById(products, state.current_item?.product_id)

    if (!product || !state.current_item) return ''

    const lines = ['PANIER STRUCTURE (source systeme, prioritaire):']
    lines.push(`- Produit courant: ${state.current_item.product_name}`)

    if (state.current_item.quantity) {
        lines.push(`- Quantite deja validee: ${state.current_item.quantity}`)
    } else {
        lines.push('- Quantite encore manquante')
    }

    const selectedVariants = Object.entries(state.current_item.selected_variants || {})
    if (selectedVariants.length > 0) {
        lines.push(`- Variantes deja collectees: ${selectedVariants.map(([label, value]) => `${label}=${value}`).join(', ')}`)
    }

    if (state.awaiting_field?.label) {
        lines.push(`- Champ bloquant actuel: ${state.awaiting_field.label}`)
    }

    lines.push('- Si le client donne une information hors ordre (ex: couleur avant quantite), memorise-la mais redemande le champ bloquant.')
    lines.push('- Interdiction de supposer une quantite par defaut.')

    if (state.stage === CART_STAGE.CART_RECAP) {
        lines.push('- Le panier produit est complet et recapitulatif pret. Attends seulement la confirmation "On continue ?" puis passe au checkout.')
    }

    if (state.stage === CART_STAGE.CHECKOUT) {
        lines.push('- Le panier produit est deja verrouille. Ne redemande ni quantite ni variantes. Passe uniquement aux informations client.')
    }

    const optionalVariants = getOptionalVariants(product)
        .filter(variant => getSelectedVariantValue(state.current_item, variant.id))
        .map(variant => `${variant.label}=${getSelectedVariantValue(state.current_item, variant.id)}`)

    if (optionalVariants.length > 0) {
        lines.push(`- Options/supplements deja collectes: ${optionalVariants.join(', ')}`)
    }

    return lines.join('\n')
}

function mergeCartStateIntoToolArgs(functionName, args = {}, cartState = {}) {
    if (functionName !== 'create_order') return args

    const state = cloneCartState(cartState)
    const item = state.current_item
    if (!item || !item.product_name || !item.quantity) return args

    const structuredItem = {
        product_name: item.product_name,
        quantity: item.quantity,
        selected_variants: { ...(item.selected_variants || {}) },
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
