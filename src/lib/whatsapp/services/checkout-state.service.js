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
}

function cloneCheckoutState(checkout = {}) {
    return {
        stage: checkout.stage || CHECKOUT_STAGE.IDLE,
        pending_fields: Array.isArray(checkout.pending_fields) ? [...checkout.pending_fields] : [],
        collected: {
            customer_name: checkout.collected?.customer_name || null,
            customer_phone: checkout.collected?.customer_phone || null,
            delivery_address: checkout.collected?.delivery_address || null,
            payment_method: checkout.collected?.payment_method || null,
            notes: checkout.collected?.notes,
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

function removePhoneFromText(text, phone) {
    if (!phone) return normalizeFreeText(text)

    const digits = phone.replace(/[^\d]/g, '')
    const compact = String(text || '').replace(/[^\dA-Za-z+ ]/g, ' ')

    if (!digits) return normalizeFreeText(compact)

    const variants = [`+${digits}`, `00${digits}`, digits]
    let sanitized = compact

    variants.forEach(variant => {
        sanitized = sanitized.split(variant).join(' ')
    })

    return normalizeFreeText(sanitized)
}

function removePendingField(state, field) {
    state.pending_fields = state.pending_fields.filter(item => item !== field)
}

function inferCheckoutStateFromAssistantMessage(content, previousState = {}) {
    const text = normalizeFreeText(content)
    const state = cloneCheckoutState(previousState)

    if (!text) return state

    if (
        /commande confirmee|commande creee|lien de paiement securise|lien de paiement/i.test(text)
    ) {
        return cloneCheckoutState({})
    }

    if (/confirmez-vous/i.test(text)) {
        state.stage = CHECKOUT_STAGE.CONFIRMATION
        state.pending_fields = []
        state.last_prompt_kind = CHECKOUT_STAGE.CONFIRMATION
        state.last_prompt_text = text
        state.note_declined = false
        return state
    }

    if (/instruction particuli|une note ou instruction|instruction pour la livraison/i.test(text)) {
        state.stage = state.note_declined || state.collected.notes ? CHECKOUT_STAGE.CONFIRMATION : CHECKOUT_STAGE.NOTES
        state.pending_fields = state.note_declined || state.collected.notes ? [] : ['notes']
        state.last_prompt_kind = CHECKOUT_STAGE.NOTES
        state.last_prompt_text = text
        return state
    }

    if (/payer en ligne ou a la livraison|payer en ligne ou à la livraison/i.test(text)) {
        state.stage = state.collected.payment_method ? CHECKOUT_STAGE.CONFIRMATION : CHECKOUT_STAGE.PAYMENT_METHOD
        state.pending_fields = state.collected.payment_method ? [] : ['payment_method']
        state.last_prompt_kind = CHECKOUT_STAGE.PAYMENT_METHOD
        state.last_prompt_text = text
        return state
    }

    const pendingFields = []
    if (/nom complet/i.test(text)) pendingFields.push('customer_name')
    if (/numero de telephone|numéro de téléphone|telephone \(avec indicatif\)|t[ée]l[ée]phone/i.test(text)) {
        pendingFields.push('customer_phone')
    }
    if (/adresse de livraison|ville, quartier|quartier/i.test(text)) {
        pendingFields.push('delivery_address')
    }

    if (pendingFields.length > 0) {
        state.stage = CHECKOUT_STAGE.CUSTOMER_FIELDS
        state.pending_fields = pendingFields.filter(field => !state.collected[field])
        state.last_prompt_kind = CHECKOUT_STAGE.CUSTOMER_FIELDS
        state.last_prompt_text = text
        return state
    }

    return state
}

function applyUserReplyToCheckoutState(checkoutState, text) {
    const state = cloneCheckoutState(checkoutState)
    const normalizedText = normalizeFreeText(text)

    if (!normalizedText) return state

    if (state.pending_fields.includes('customer_phone')) {
        const phone = extractPhoneFromText(normalizedText) || normalizeWhatsAppContact(normalizedText)
        if (phone) {
            state.collected.customer_phone = phone
            removePendingField(state, 'customer_phone')
        }
    }

    if (state.pending_fields.includes('payment_method')) {
        const paymentMethod = detectPaymentMethod(normalizedText)
        if (paymentMethod) {
            state.collected.payment_method = paymentMethod
            removePendingField(state, 'payment_method')
        }
    }

    if (state.pending_fields.includes('notes')) {
        state.note_declined = isNegativeReply(normalizedText)
        state.collected.notes = state.note_declined ? '' : normalizedText
        removePendingField(state, 'notes')
    }

    if (state.stage === CHECKOUT_STAGE.CUSTOMER_FIELDS) {
        let remainingText = removePhoneFromText(normalizedText, state.collected.customer_phone)

        if (remainingText && state.pending_fields.includes('customer_name') && !state.collected.customer_name) {
            if (remainingText.includes(',')) {
                const [namePart, ...rest] = remainingText.split(',')
                const cleanName = normalizeFreeText(namePart)
                const cleanAddress = normalizeFreeText(rest.join(','))

                if (cleanName) {
                    state.collected.customer_name = cleanName
                    removePendingField(state, 'customer_name')
                }

                if (cleanAddress && state.pending_fields.includes('delivery_address')) {
                    state.collected.delivery_address = cleanAddress
                    removePendingField(state, 'delivery_address')
                }

                remainingText = ''
            } else if (tokenizeWords(remainingText).length <= 4) {
                state.collected.customer_name = remainingText
                removePendingField(state, 'customer_name')
                remainingText = ''
            }
        }

        if (
            remainingText &&
            state.pending_fields.includes('delivery_address') &&
            !state.pending_fields.includes('customer_name') &&
            !state.collected.delivery_address
        ) {
            state.collected.delivery_address = remainingText
            removePendingField(state, 'delivery_address')
        }
    }

    return state
}

function buildCheckoutStateGuidance(checkoutState) {
    const state = cloneCheckoutState(checkoutState)
    const collected = state.collected || {}
    const lines = []

    if (!state.last_prompt_kind && !Object.values(collected).some(Boolean)) {
        return ''
    }

    lines.push('CHECKOUT STATE (source systeme, prioritaire):')

    if (state.last_prompt_kind) {
        lines.push(`- Etape courante: ${state.last_prompt_kind}`)
    }

    if (collected.customer_name) lines.push(`- Nom deja collecte: ${collected.customer_name}`)
    if (collected.customer_phone) lines.push(`- Telephone deja collecte: ${collected.customer_phone}`)
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

    if (state.pending_fields.length > 0) {
        const labels = {
            customer_name: 'nom complet',
            customer_phone: 'numero de telephone avec indicatif',
            delivery_address: 'adresse de livraison',
            payment_method: 'mode de paiement',
            notes: 'instruction particuliere',
        }
        lines.push(`- Demande uniquement les champs encore manquants: ${state.pending_fields.map(field => labels[field] || field).join(', ')}`)
    }

    return lines.join('\n')
}

function mergeCheckoutStateIntoToolArgs(functionName, args = {}, checkoutState = {}) {
    if (functionName !== 'create_order') return args

    const state = cloneCheckoutState(checkoutState)
    const collected = state.collected || {}

    return {
        ...args,
        customer_name: args.customer_name || collected.customer_name || args.customer_name,
        customer_phone: args.customer_phone || collected.customer_phone || args.customer_phone,
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
}
