const { calculateItemPrice } = require('../ai/tools/pricing-logic')
const {
    normalizePhoneNumber,
    normalizeWhatsAppContact,
} = require('../ai/tools/tool-helpers')

const CHECKOUT_STAGE = {
    IDLE: 'idle',
    CUSTOMER_FIELDS: 'customer_fields',
    PAYMENT_METHOD: 'payment_method',
    NOTES: 'notes',
    CONFIRMATION: 'confirmation',
    EDIT_SELECTION: 'edit_selection',
}

function cloneAwaitingField(field = null) {
    if (!field) return null
    return { ...field }
}

function cloneCheckoutState(checkout = {}) {
    return {
        stage: checkout.stage || CHECKOUT_STAGE.IDLE,
        pending_fields: Array.isArray(checkout.pending_fields) ? [...checkout.pending_fields] : [],
        awaiting_field: cloneAwaitingField(checkout.awaiting_field),
        collected: {
            customer_name: checkout.collected?.customer_name || null,
            customer_phone: checkout.collected?.customer_phone || null,
            email: checkout.collected?.email || null,
            delivery_address: checkout.collected?.delivery_address || null,
            payment_method: checkout.collected?.payment_method || null,
            notes: checkout.collected?.notes ?? null,
        },
        last_prompt_kind: checkout.last_prompt_kind || null,
        last_prompt_text: checkout.last_prompt_text || null,
        note_declined: checkout.note_declined === true,
        updated_at: checkout.updated_at || null,
    }
}

function getCheckoutState(metadata = {}) {
    return cloneCheckoutState(metadata.checkout || {})
}

function setCheckoutState(metadata = {}, checkoutState) {
    return {
        ...(metadata || {}),
        checkout: {
            ...cloneCheckoutState(checkoutState),
            updated_at: new Date().toISOString(),
        }
    }
}

function clearCheckoutState(metadata = {}) {
    return {
        ...(metadata || {}),
        checkout: null
    }
}

function normalizeFreeText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
}

function tokenizeWords(text) {
    return normalizeFreeText(text)
        .split(' ')
        .map(word => word.trim())
        .filter(Boolean)
}

function isPositiveReply(text) {
    const normalized = normalizeFreeText(text).toLowerCase()
    return [
        'oui',
        'ok',
        'okay',
        "d'accord",
        'daccord',
        'cest bon',
        "c'est bon",
        'confirme',
        'je confirme',
        'valider',
    ].includes(normalized)
}

function isNegativeReply(text) {
    const normalized = normalizeFreeText(text).toLowerCase()
    return [
        'non',
        'non merci',
        'aucune',
        'aucune instruction',
        'pas de note',
        'pas dinstruction',
        'pas d instruction',
        'rien',
        'ras',
        'none',
        'no',
    ].includes(normalized)
}

function detectPaymentMethod(text) {
    const normalized = normalizeFreeText(text).toLowerCase()

    if (!normalized) return null

    if (
        normalized.includes('livraison') ||
        normalized.includes('cash') ||
        normalized.includes('contre remboursement')
    ) {
        return 'cod'
    }

    if (
        normalized.includes('en ligne') ||
        normalized.includes('online') ||
        normalized.includes('mobile money') ||
        normalized.includes('payer maintenant') ||
        normalized.includes('carte')
    ) {
        return 'online'
    }

    return null
}

function extractPhoneFromText(text) {
    const candidates = String(text || '').match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) || []

    for (const candidate of candidates) {
        const normalized = normalizePhoneNumber(candidate)
        if (normalized) {
            return normalized
        }
    }

    return null
}

function extractEmailFromText(text) {
    const match = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    return match ? match[0].toLowerCase() : null
}


function extractCustomerName(text, lenient = false) {
    const normalized = normalizeFreeText(text)
        .replace(/[^\p{L}A-Za-z' -]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (!normalized) return null

    const tokens = tokenizeWords(normalized)
    const minTokens = lenient ? 1 : 2
    if (tokens.length < minTokens || tokens.length > 6) return null

    return normalized
}

function extractDeliveryAddress(text) {
    const normalized = normalizeFreeText(text)
    if (!normalized) return null

    const tokens = tokenizeWords(normalized)
    if (tokens.length < 2) return null

    return normalized
}

function removePendingField(state, field) {
    state.pending_fields = state.pending_fields.filter(item => item !== field)
}

function findProductById(products = [], productId) {
    return (products || []).find(product => product.id === productId) || null
}

function buildCheckoutContext(cartState = {}, products = []) {
    const cartItems = Array.isArray(cartState.cart_items) ? cartState.cart_items : []
    const draftItem = cartState.draft_item || null
    const allItems = cartItems.length > 0 ? cartItems : (draftItem ? [draftItem] : [])
    const resolvedProducts = allItems
        .map(item => findProductById(products, item.product_id))
        .filter(Boolean)

    const hasDigital = resolvedProducts.some(product => product.product_type === 'digital')
    const hasPhysical = resolvedProducts.some(product => product.product_type !== 'digital')

    return {
        products: resolvedProducts,
        hasDigital,
        hasPhysical,
        isDigital: hasDigital && !hasPhysical,
        requiresEmail: hasDigital,
        requiresAddress: hasPhysical,
        requiresPaymentChoice: !hasDigital,
        requiresNotes: hasPhysical,
    }
}

function getRequiredCustomerFields(context) {
    return [
        'customer_name',
        'customer_phone',
        ...(context.requiresEmail ? ['email'] : []),
        ...(context.requiresAddress ? ['delivery_address'] : []),
    ]
}

function buildAwaitingField(field, context) {
    const prompts = {
        customer_name: {
            type: 'customer_name',
            label: 'nom complet',
            prompt: 'Quel est votre nom complet ? (ex : Koffi Diby)'
        },
        customer_phone: {
            type: 'customer_phone',
            label: 'numero de telephone',
            prompt: 'Quel est votre numero de telephone avec indicatif ? (ex : +2250700000000)'
        },
        email: {
            type: 'email',
            label: 'adresse email',
            prompt: 'Quelle est votre adresse email ? (ex : koffi@gmail.com)'
        },
        delivery_address: {
            type: 'delivery_address',
            label: 'adresse de livraison',
            prompt: 'Quelle est votre adresse de livraison ? (ex : Abidjan, Yopougon)'
        },
        payment_method: {
            type: 'payment_method',
            label: 'mode de paiement',
            prompt: context.isDigital
                ? 'Le paiement de ce produit se fait en ligne.'
                : 'Souhaitez-vous payer en ligne ou a la livraison ?'
        },
        notes: {
            type: 'notes',
            label: 'instruction particuliere',
            prompt: 'Souhaitez-vous ajouter une instruction particuliere pour la livraison ?'
        },
        confirmation: {
            type: 'confirmation',
            label: 'confirmation',
            prompt: 'Confirmez-vous cette commande ?'
        },
        edit_selection: {
            type: 'edit_selection',
            label: 'modification',
            prompt: 'Que souhaitez-vous modifier ? (nom, telephone, email, adresse, paiement ou note)'
        },
    }

    return cloneAwaitingField(prompts[field] || null)
}

function hasCheckoutData(state) {
    if (!state) return false

    return state.stage !== CHECKOUT_STAGE.IDLE ||
        state.pending_fields.length > 0 ||
        !!state.awaiting_field ||
        state.note_declined === true ||
        Object.values(state.collected || {}).some(value => value !== null && value !== '')
}

function recomputeCheckoutProgress(state, context) {
    const requiredCustomerFields = getRequiredCustomerFields(context)
    const missingCustomerFields = requiredCustomerFields.filter(field => !state.collected[field])

    if (missingCustomerFields.length > 0) {
        state.stage = CHECKOUT_STAGE.CUSTOMER_FIELDS
        state.pending_fields = missingCustomerFields
        state.awaiting_field = buildAwaitingField(missingCustomerFields[0], context)
        return state
    }

    if (context.isDigital && !state.collected.payment_method) {
        state.collected.payment_method = 'online'
    }

    if (!state.collected.payment_method) {
        state.stage = CHECKOUT_STAGE.PAYMENT_METHOD
        state.pending_fields = ['payment_method']
        state.awaiting_field = buildAwaitingField('payment_method', context)
        return state
    }

    if (context.requiresNotes && state.collected.notes === null && !state.note_declined) {
        state.stage = CHECKOUT_STAGE.NOTES
        state.pending_fields = ['notes']
        state.awaiting_field = buildAwaitingField('notes', context)
        return state
    }

    state.stage = CHECKOUT_STAGE.CONFIRMATION
    state.pending_fields = []
    state.awaiting_field = buildAwaitingField('confirmation', context)
    return state
}

function activateCheckoutState(previousState = {}, context) {
    const state = cloneCheckoutState(previousState)
    if (hasCheckoutData(state)) {
        return recomputeCheckoutProgress(state, context)
    }

    state.note_declined = false
    state.collected.notes = null
    return recomputeCheckoutProgress(state, context)
}

function buildOrderRecap(cartState = {}, checkoutState = {}, context) {
    const cartItems = Array.isArray(cartState.cart_items) ? cartState.cart_items : []
    if (cartItems.length === 0) {
        return 'Recapitulatif :\n\nJe suis pret a finaliser votre commande. Confirmez-vous ?'
    }

    const lines = ['Recapitulatif :', '']
    const total = cartItems.reduce((sum, item) => {
        if (Number.isFinite(Number(item.line_total))) return sum + Number(item.line_total)

        const product = findProductById(context.products, item.product_id) || context.products.find(product => product.id === item.product_id)
        if (!product) return sum
        const pricing = calculateItemPrice(
            product,
            { ...(item.selected_variants || {}) },
            item.product_name || product.name,
            item.quantity || 1
        )
        return sum + ((pricing.price || product.price_fcfa || 0) * (item.quantity || 0))
    }, 0)

    cartItems.forEach(item => {
        const variants = Object.values(item.selected_variants || {}).filter(Boolean).join(', ')
        const variantSuffix = variants ? ` (${variants})` : ''
        const lineTotal = Number.isFinite(Number(item.line_total))
            ? Number(item.line_total)
            : ((Number(item.unit_price) || 0) * (item.quantity || 0))

        lines.push(`- Produit : ${item.product_name}${variantSuffix} x ${item.quantity} = ${lineTotal.toLocaleString('fr-FR')} FCFA`)
    })

    const paymentLabel = checkoutState.collected.payment_method === 'cod' ? 'A la livraison' : 'En ligne'
    const noteLabel = checkoutState.note_declined || !checkoutState.collected.notes
        ? 'Aucune'
        : checkoutState.collected.notes

    lines.push(
        '',
        `- Nom : ${checkoutState.collected.customer_name || 'Non renseigne'}`,
        `- Tel : ${checkoutState.collected.customer_phone || 'Non renseigne'}`,
    )

    if (context.requiresEmail) {
        lines.push(`- Email : ${checkoutState.collected.email || 'Non renseignee'}`)
    }

    if (context.requiresAddress) {
        lines.push(`- Adresse : ${checkoutState.collected.delivery_address || 'Non renseignee'}`)
    }

    lines.push(`- Paiement : ${paymentLabel}`)
    lines.push(`- Total : ${total.toLocaleString('fr-FR')} FCFA`)

    if (context.requiresNotes) {
        lines.push(`- Note : ${noteLabel}`)
    }

    lines.push('', 'Confirmez-vous ?')

    return lines.join('\n')
}

function buildCapturedSummary(captured = []) {
    if (!captured || captured.length === 0) return ''

    if (captured.length === 1) {
        const entry = captured[0]
        switch (entry.type) {
            case 'customer_name': return `Super, ${entry.value} !`
            case 'customer_phone': return 'Parfait !'
            case 'email': return 'D\'accord !'
            case 'delivery_address': return 'D\'accord !'
            case 'payment_method': return entry.value === 'cod' ? 'Paiement a la livraison, entendu !' : 'Paiement en ligne, entendu !'
            case 'notes': return entry.value === 'Aucune' ? 'Aucun probleme !' : 'Noté !'
            default: return 'D\'accord !'
        }
    }

    return 'Parfait !'
}

function buildStructuredCheckoutReply(state, cartState, products = [], captured = [], options = {}) {
    const context = buildCheckoutContext(cartState, products)
    const acknowledgement = buildCapturedSummary(captured)

    if (state.stage === CHECKOUT_STAGE.EDIT_SELECTION) {
        return 'D accord. Que souhaitez-vous modifier ? (nom, telephone, email, adresse, paiement ou note)'
    }

    if (state.stage === CHECKOUT_STAGE.CONFIRMATION) {
        return [acknowledgement, buildOrderRecap(cartState, state, context)].filter(Boolean).join('\n\n')
    }

    if (!state.awaiting_field?.prompt) {
        return acknowledgement || null
    }

    return [acknowledgement, state.awaiting_field.prompt].filter(Boolean).join(' ')
}

function detectFieldToEdit(text, context) {
    const normalized = normalizeFreeText(text).toLowerCase()
    if (!normalized) return null

    if (normalized.includes('nom')) return 'customer_name'
    if (normalized.includes('telephone') || normalized.includes('tel')) return 'customer_phone'
    if (normalized.includes('email') && context.requiresEmail) return 'email'
    if ((normalized.includes('adresse') || normalized.includes('livraison')) && context.requiresAddress) return 'delivery_address'
    if (normalized.includes('paiement') || normalized.includes('payer')) return 'payment_method'
    if (normalized.includes('note') || normalized.includes('instruction')) return 'notes'

    return null
}

function reopenFieldForEdition(state, field, context) {
    if (field === 'payment_method') {
        state.collected.payment_method = null
    } else if (field === 'notes') {
        state.collected.notes = null
        state.note_declined = false
    } else {
        state.collected[field] = null
    }

    state.pending_fields = [field]
    state.stage = field === 'payment_method'
        ? CHECKOUT_STAGE.PAYMENT_METHOD
        : (field === 'notes' ? CHECKOUT_STAGE.NOTES : CHECKOUT_STAGE.CUSTOMER_FIELDS)
    state.awaiting_field = buildAwaitingField(field, context)
    return state
}

function updateCheckoutStateFromUserMessage(previousState, text, options = {}) {
    const {
        cartState = {},
        products = [],
        activateCheckout = false,
    } = options

    const context = buildCheckoutContext(cartState, products)
    const hasCartLines = Array.isArray(cartState?.cart_items) && cartState.cart_items.length > 0
    if (!hasCartLines || cartState.stage !== 'checkout') {
        return {
            state: cloneCheckoutState(previousState),
            capturedFields: [],
            stateChanged: false,
            shouldBypassAI: false,
            directReply: null,
            shouldSubmitOrder: false,
        }
    }

    const previousStructuredState = cloneCheckoutState(previousState)
    let state = activateCheckoutState(previousStructuredState, context)
    const normalizedText = normalizeFreeText(text)
    const capturedFields = []

    if (activateCheckout && !hasCheckoutData(previousStructuredState)) {
        state.last_prompt_kind = state.stage
        state.last_prompt_text = normalizedText
        return {
            state,
            capturedFields,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: buildStructuredCheckoutReply(state, cartState, products, [], { initialPrompt: true }),
            shouldSubmitOrder: false,
        }
    }

    if (!normalizedText) {
        return {
            state,
            capturedFields,
            stateChanged: false,
            shouldBypassAI: false,
            directReply: null,
            shouldSubmitOrder: false,
        }
    }

    const previousAwaiting = cloneAwaitingField(state.awaiting_field)
    const previousSnapshot = JSON.stringify(state)

    if (state.stage === CHECKOUT_STAGE.CONFIRMATION) {
        if (isPositiveReply(normalizedText)) {
            state.last_prompt_kind = CHECKOUT_STAGE.CONFIRMATION
            state.last_prompt_text = normalizedText
            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: false,
                directReply: null,
                shouldSubmitOrder: true,
            }
        }

        if (isNegativeReply(normalizedText)) {
            state.stage = CHECKOUT_STAGE.EDIT_SELECTION
            state.pending_fields = []
            state.awaiting_field = buildAwaitingField('edit_selection', context)
            state.last_prompt_kind = CHECKOUT_STAGE.EDIT_SELECTION
            state.last_prompt_text = normalizedText
            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: buildStructuredCheckoutReply(state, cartState, products),
                shouldSubmitOrder: false,
            }
        }
    }

    if (state.stage === CHECKOUT_STAGE.EDIT_SELECTION) {
        const fieldToEdit = detectFieldToEdit(normalizedText, context)
        if (fieldToEdit) {
            state = reopenFieldForEdition(state, fieldToEdit, context)
            state.last_prompt_kind = state.stage
            state.last_prompt_text = normalizedText

            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: buildStructuredCheckoutReply(state, cartState, products),
                shouldSubmitOrder: false,
            }
        }

        return {
            state,
            capturedFields,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: 'D accord. Indiquez simplement ce que vous souhaitez modifier : nom, telephone, email, adresse, paiement ou note.',
            shouldSubmitOrder: false,
        }
    }

    if (!state.collected.customer_phone) {
        const phone = extractPhoneFromText(normalizedText) || normalizeWhatsAppContact(normalizedText)
        if (phone) {
            state.collected.customer_phone = phone
            removePendingField(state, 'customer_phone')
            capturedFields.push({ type: 'customer_phone', value: phone })
        }
    }

    if (context.requiresEmail && !state.collected.email) {
        const email = extractEmailFromText(normalizedText)
        if (email) {
            state.collected.email = email
            removePendingField(state, 'email')
            capturedFields.push({ type: 'email', value: email })
        }
    }

    if (!state.collected.payment_method) {
        const paymentMethod = detectPaymentMethod(normalizedText)
        if (paymentMethod) {
            state.collected.payment_method = paymentMethod
            removePendingField(state, 'payment_method')
            capturedFields.push({ type: 'payment_method', value: paymentMethod })
        }
    }

    if (state.stage === CHECKOUT_STAGE.NOTES) {
        state.note_declined = isNegativeReply(normalizedText)
        state.collected.notes = state.note_declined ? '' : normalizedText
        removePendingField(state, 'notes')
        capturedFields.push({ type: 'notes', value: state.note_declined ? 'Aucune' : normalizedText })
    } else if (state.stage === CHECKOUT_STAGE.CUSTOMER_FIELDS) {
        // Split on commas/semicolons/newlines BEFORE any phone removal (removePhoneFromText
        // destroys commas, making multi-field detection fail).
        const rawSegments = normalizedText.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
        const isMultiSegment = rawSegments.length > 1

        // Filter out segments that were already captured as phone or email
        const textSegments = rawSegments.filter(segment => {
            if (extractPhoneFromText(segment)) return false
            if (context.requiresEmail && extractEmailFromText(segment)) return false
            return true
        })

        if (isMultiSegment) {
            // Multiple comma-separated segments: assign in order name → address
            for (const segment of textSegments) {
                if (state.pending_fields.includes('customer_name') && !state.collected.customer_name) {
                    const name = extractCustomerName(segment)
                    if (name) {
                        state.collected.customer_name = name
                        removePendingField(state, 'customer_name')
                        capturedFields.push({ type: 'customer_name', value: name })
                        continue
                    }
                }
                if (context.requiresAddress && state.pending_fields.includes('delivery_address') && !state.collected.delivery_address) {
                    const address = extractDeliveryAddress(segment)
                    if (address) {
                        state.collected.delivery_address = address
                        removePendingField(state, 'delivery_address')
                        capturedFields.push({ type: 'delivery_address', value: address })
                    }
                }
            }
        } else if (textSegments.length === 1) {
            // Single text segment: use awaiting_field.type as context hint
            const segment = textSegments[0]
            const awaitingType = state.awaiting_field?.type

            if (awaitingType === 'delivery_address' || (!state.pending_fields.includes('customer_name') && context.requiresAddress)) {
                // Bot was asking for address, or name already collected
                const address = extractDeliveryAddress(segment)
                if (address && !state.collected.delivery_address) {
                    state.collected.delivery_address = address
                    removePendingField(state, 'delivery_address')
                    capturedFields.push({ type: 'delivery_address', value: address })
                }
            } else {
                // Bot was asking for name (or anything else)
                const name = extractCustomerName(segment, true) // lenient: accept 1 token
                if (name && state.pending_fields.includes('customer_name') && !state.collected.customer_name) {
                    state.collected.customer_name = name
                    removePendingField(state, 'customer_name')
                    capturedFields.push({ type: 'customer_name', value: name })
                } else if (context.requiresAddress && state.pending_fields.includes('delivery_address') && !state.collected.delivery_address) {
                    // Name extraction failed (too many tokens?) → try as address
                    const address = extractDeliveryAddress(segment)
                    if (address) {
                        state.collected.delivery_address = address
                        removePendingField(state, 'delivery_address')
                        capturedFields.push({ type: 'delivery_address', value: address })
                    }
                }
            }
        }
    }

    state = recomputeCheckoutProgress(state, context)
    state.last_prompt_kind = state.stage
    state.last_prompt_text = normalizedText

    const awaitingChanged = JSON.stringify(previousAwaiting) !== JSON.stringify(state.awaiting_field)
    const stateChanged = previousSnapshot !== JSON.stringify(state)
    const shouldBypassAI = stateChanged || awaitingChanged

    return {
        state,
        capturedFields,
        stateChanged: stateChanged || awaitingChanged,
        shouldBypassAI,
        directReply: shouldBypassAI
            ? buildStructuredCheckoutReply(state, cartState, products, capturedFields)
            : null,
        shouldSubmitOrder: false,
    }
}

function buildCheckoutStateGuidance(checkoutState) {
    const state = cloneCheckoutState(checkoutState)
    const collected = state.collected || {}
    const lines = []

    if (!hasCheckoutData(state)) {
        return ''
    }

    lines.push('CHECKOUT STATE (source systeme, prioritaire):')

    if (state.stage) {
        lines.push(`- Etape courante: ${state.stage}`)
    }

    if (collected.customer_name) lines.push(`- Nom deja collecte: ${collected.customer_name}`)
    if (collected.customer_phone) lines.push(`- Telephone deja collecte: ${collected.customer_phone}`)
    if (collected.email) lines.push(`- Email deja collecte: ${collected.email}`)
    if (collected.delivery_address) lines.push(`- Adresse deja collectee: ${collected.delivery_address}`)

    if (collected.payment_method) {
        lines.push(`- Paiement deja choisi: ${collected.payment_method === 'cod' ? 'a la livraison' : 'en ligne'}`)
        lines.push('- Interdiction de redemander le mode de paiement.')
    }

    if (state.note_declined) {
        lines.push('- Le client a refuse d ajouter une instruction particuliere.')
        lines.push('- Passe directement au recapitulatif final et a la confirmation.')
    } else if (state.collected.notes) {
        lines.push(`- Note deja fournie: ${state.collected.notes}`)
    }

    if (state.awaiting_field?.label) {
        lines.push(`- Champ bloquant actuel: ${state.awaiting_field.label}`)
    }

    if (state.pending_fields.length > 0) {
        const labels = {
            customer_name: 'nom complet',
            customer_phone: 'numero de telephone avec indicatif',
            email: 'adresse email',
            delivery_address: 'adresse de livraison',
            payment_method: 'mode de paiement',
            notes: 'instruction particuliere',
        }
        lines.push(`- Demande uniquement les champs encore manquants: ${state.pending_fields.map(field => labels[field] || field).join(', ')}`)
    }

    return lines.join('\n')
}

function inferCheckoutStateFromAssistantMessage(content, previousState = {}) {
    const text = normalizeFreeText(content)
    const state = cloneCheckoutState(previousState)

    if (!text) return state

    if (/commande confirmee|commande creee|lien de paiement securise|lien de paiement/i.test(text)) {
        return cloneCheckoutState({})
    }

    return state
}

function applyUserReplyToCheckoutState(checkoutState, text) {
    return updateCheckoutStateFromUserMessage(checkoutState, text, {}).state
}

function mergeCheckoutStateIntoToolArgs(functionName, args = {}, checkoutState = {}) {
    if (functionName !== 'create_order') return args

    const state = cloneCheckoutState(checkoutState)
    const collected = state.collected || {}

    return {
        ...args,
        customer_name: args.customer_name || collected.customer_name || args.customer_name,
        customer_phone: args.customer_phone || collected.customer_phone || args.customer_phone,
        email: args.email || collected.email || args.email,
        delivery_address: args.delivery_address || collected.delivery_address || args.delivery_address,
        payment_method: args.payment_method || collected.payment_method || args.payment_method,
        notes: args.notes !== undefined ? args.notes : collected.notes,
    }
}

module.exports = {
    CHECKOUT_STAGE,
    applyUserReplyToCheckoutState,
    buildCheckoutStateGuidance,
    clearCheckoutState,
    getCheckoutState,
    inferCheckoutStateFromAssistantMessage,
    mergeCheckoutStateIntoToolArgs,
    setCheckoutState,
    updateCheckoutStateFromUserMessage,
}
