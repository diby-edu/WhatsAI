const { calculateItemPrice } = require('../../ai/tools/pricing-logic')
const { CHECKOUT_STAGE, cloneCheckoutState, cloneAwaitingField } = require('./persistence')
const { normalizeFreeText } = require('./parsing')

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

    const hasDigital = resolvedProducts.some(product => product.product_type === 'digital' || product.product_type === 'virtual')
    const hasPhysical = resolvedProducts.some(product => product.product_type === 'product' || product.product_type === 'physical' || product.product_type === 'good')

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

const FIELD_LABELS = {
    customer_name: 'Nom',
    customer_phone: 'Telephone',
    email: 'Email',
    delivery_address: 'Adresse',
    payment_method: 'Paiement',
    notes: 'Note de livraison',
}

function getEditableFields(context) {
    return [
        'customer_name',
        'customer_phone',
        ...(context.requiresEmail ? ['email'] : []),
        ...(context.requiresAddress ? ['delivery_address'] : []),
        ...(context.requiresPaymentChoice ? ['payment_method'] : []),
        ...(context.requiresNotes ? ['notes'] : []),
    ]
}

function buildEditMenu(context) {
    const fields = getEditableFields(context)
    return [
        'Que souhaitez-vous modifier ?',
        ...fields.map((f, i) => `${i + 1}. ${FIELD_LABELS[f]}`),
    ].join('\n')
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
            prompt: 'Quel est votre numero de telephone avec indicatif ? (ex : +2250554585927)'
        },
        email: {
            type: 'email',
            label: 'adresse email',
            prompt: 'Quelle est votre adresse email ? (ex : koffi@gmail.com)'
        },
        delivery_address: {
            type: 'delivery_address',
            label: 'adresse de livraison',
            prompt: 'Quelle est votre adresse complete de livraison ? (ville, quartier, rue) ou partagez votre geolocalisation Google Maps.'
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
        customer_recap: {
            type: 'customer_recap',
            label: 'recap informations client',
            prompt: null,
        },
        edit_selection: {
            type: 'edit_selection',
            label: 'modification',
            prompt: buildEditMenu(context),
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

    if (!context.requiresPaymentChoice && !state.collected.payment_method) {
        state.collected.payment_method = 'online'
    }

    if (context.requiresPaymentChoice && !state.collected.payment_method) {
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

    // Préserver les stages transitoires : leurs handlers gèrent eux-mêmes la navigation
    // recomputeCheckoutProgress écraserait EDIT_SELECTION → CUSTOMER_RECAP (bug)
    const transientStages = [CHECKOUT_STAGE.EDIT_SELECTION, CHECKOUT_STAGE.CONFIRMATION]
    if (transientStages.includes(state.stage)) {
        return state
    }

    if (hasCheckoutData(state)) {
        return recomputeCheckoutProgress(state, context)
    }

    state.note_declined = false
    state.collected.notes = null
    return recomputeCheckoutProgress(state, context)
}

function prepareCheckoutStateForCartEdit(previousState = {}, cartState = {}, products = []) {
    const context = buildCheckoutContext(cartState, products)
    const state = cloneCheckoutState(previousState)

    if (!hasCheckoutData(state)) {
        return state
    }

    // Returning to the cart should preserve the already confirmed customer
    // information. We only need to rebuild the final order recap with the new
    // basket contents.

    const nextState = recomputeCheckoutProgress(state, context)
    nextState.last_prompt_kind = nextState.stage
    nextState.last_prompt_text = null

    return nextState
}

function buildOrderRecap(cartState = {}, checkoutState = {}, context) {
    const cartItems = Array.isArray(cartState.cart_items) ? cartState.cart_items : []
    if (cartItems.length === 0) {
        return 'Recapitulatif :\n\nJe suis pret a finaliser votre commande. Confirmez-vous ?'
    }

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

    const paymentLabel = checkoutState.collected.payment_method === 'cod' ? 'A la livraison' : 'En ligne'
    const noteLabel = checkoutState.note_declined || !checkoutState.collected.notes
        ? 'Aucune'
        : checkoutState.collected.notes

    const lines = ['*Récapitulatif de votre commande*', '', '🛒 *Produits*']

    cartItems.forEach(item => {
        const variants = Object.values(item.selected_variants || {}).filter(Boolean).join(', ')
        const variantSuffix = variants ? ` (${variants})` : ''
        const lineTotal = Number.isFinite(Number(item.line_total))
            ? Number(item.line_total)
            : ((Number(item.unit_price) || 0) * (item.quantity || 0))

        lines.push(`• ${item.product_name}${variantSuffix} x ${item.quantity} = ${lineTotal.toLocaleString('fr-FR')} FCFA`)
    })

    lines.push('', '👤 *Vos infos*')
    lines.push(`• Nom : ${checkoutState.collected.customer_name || 'Non renseigne'}`)
    lines.push(`• Tel : ${checkoutState.collected.customer_phone || 'Non renseigne'}`)

    if (context.requiresEmail) {
        lines.push(`• Email : ${checkoutState.collected.email || 'Non renseignee'}`)
    }

    if (context.requiresAddress) {
        lines.push(`• Adresse : ${checkoutState.collected.delivery_address || 'Non renseignee'}`)
    }

    lines.push(`• Paiement : ${paymentLabel}`)

    if (context.requiresNotes) {
        lines.push(`• Note : ${noteLabel}`)
    }

    lines.push('', `*Total : ${total.toLocaleString('fr-FR')} FCFA*`)
    lines.push('', 'Confirmez-vous ?', '→ *oui* — confirmer la commande', '→ *modifier infos* — changer nom / tél / email', '→ *modifier produit* — changer les produits')

    return lines.join('\n')
}

function buildCustomerInfoRecap(checkoutState, context) {
    const c = checkoutState.collected || {}
    const paymentLabel = c.payment_method === 'cod' ? 'A la livraison' : 'En ligne'
    const lines = ['Vos informations :']
    lines.push(`- Nom : ${c.customer_name || 'Non renseigne'}`)
    lines.push(`- Tel : ${c.customer_phone || 'Non renseigne'}`)
    if (context.requiresEmail) lines.push(`- Email : ${c.email || 'Non renseigne'}`)
    if (context.requiresAddress) lines.push(`- Adresse : ${c.delivery_address || 'Non renseignee'}`)
    lines.push(`- Paiement : ${paymentLabel}`)
    lines.push('', '1. Continuer', '2. Modifier une information')
    return lines.join('\n')
}

function buildCapturedSummary(captured = []) {
    if (!captured || captured.length === 0) return ''

    if (captured.length === 1) {
        const entry = captured[0]
        switch (entry.type) {
            case 'customer_name': return `Super, ${entry.value} !`
            case 'customer_phone': return 'Bien noté !'
            case 'email': return 'Email bien noté !'
            case 'delivery_address': return 'Adresse notée !'
            case 'payment_method': return entry.value === 'cod' ? 'Paiement a la livraison, entendu !' : 'Paiement en ligne, entendu !'
            case 'notes': return entry.value === 'Aucune' ? 'Aucun probleme !' : 'Noté !'
            default: return 'D\'accord !'
        }
    }

    return 'Parfait !'
}

function buildStructuredCheckoutReply(state, cartState, products = [], captured = []) {
    const context = buildCheckoutContext(cartState, products)
    const acknowledgement = buildCapturedSummary(captured)

    if (state.stage === CHECKOUT_STAGE.CUSTOMER_RECAP) {
        return [acknowledgement, buildCustomerInfoRecap(state, context)].filter(Boolean).join('\n\n')
    }

    if (state.stage === CHECKOUT_STAGE.EDIT_SELECTION) {
        return [acknowledgement, state.awaiting_field.prompt].filter(Boolean).join('\n\n')
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
    const normalized = normalizeFreeText(text).toLowerCase().trim()
    if (!normalized) return null

    const fields = getEditableFields(context)

    // Détection par numéro (menu numéroté)
    const num = parseInt(normalized)
    if (!isNaN(num) && num >= 1 && num <= fields.length) return fields[num - 1]

    // Détection par mot-clé (texte libre)
    if (normalized.includes('nom')) return 'customer_name'
    if (normalized.includes('telephone') || normalized.includes('tel') || normalized.includes('numero')) return 'customer_phone'
    if (normalized.includes('email') && context.requiresEmail) return 'email'
    if ((normalized.includes('adresse') || normalized.includes('livraison')) && context.requiresAddress) return 'delivery_address'
    if ((normalized.includes('paiement') || normalized.includes('payer')) && context.requiresPaymentChoice) return 'payment_method'
    if ((normalized.includes('note') || normalized.includes('instruction')) && context.requiresNotes) return 'notes'

    return null
}

function reopenFieldForEdition(state, field, context) {
    if (field === 'payment_method') {
        state.collected.payment_method = null
        state.customer_recap_confirmed = false
    } else if (field === 'notes') {
        state.collected.notes = null
        state.note_declined = false
    } else {
        state.collected[field] = null
        state.customer_recap_confirmed = false
    }

    state.pending_fields = [field]
    state.stage = field === 'payment_method'
        ? CHECKOUT_STAGE.PAYMENT_METHOD
        : (field === 'notes' ? CHECKOUT_STAGE.NOTES : CHECKOUT_STAGE.CUSTOMER_FIELDS)
    state.awaiting_field = buildAwaitingField(field, context)
    return state
}


module.exports = {
    findProductById,
    buildCheckoutContext,
    getRequiredCustomerFields,
    getEditableFields,
    buildEditMenu,
    buildAwaitingField,
    hasCheckoutData,
    recomputeCheckoutProgress,
    activateCheckoutState,
    prepareCheckoutStateForCartEdit,
    buildOrderRecap,
    buildCustomerInfoRecap,
    buildCapturedSummary,
    buildStructuredCheckoutReply,
    detectFieldToEdit,
    reopenFieldForEdition,
}
