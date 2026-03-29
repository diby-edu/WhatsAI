const {
    normalizePhoneNumber,
} = require('../ai/tools/tool-helpers')

const RESTAURANT_STAGE = {
    IDLE: 'idle',
    COLLECTING: 'collecting',
    RECAP: 'recap',
    READY: 'ready',
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

function cloneItems(items = []) {
    return Array.isArray(items)
        ? items.map(item => ({
            product_id: item.product_id || null,
            product_name: item.product_name || null,
            quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
            unit_price_fcfa: Number.isFinite(Number(item.unit_price_fcfa)) ? Number(item.unit_price_fcfa) : null,
            line_total_fcfa: Number.isFinite(Number(item.line_total_fcfa)) ? Number(item.line_total_fcfa) : null,
            product_category: item.product_category || null,
        }))
        : []
}

function cloneAwaitingField(field = null) {
    if (!field) return null
    return { ...field }
}

function cloneRestaurantState(state = {}) {
    return {
        stage: state.stage || RESTAURANT_STAGE.IDLE,
        mode: state.mode || null,
        items: cloneItems(state.items || []),
        customer_name: state.customer_name || null,
        customer_phone: state.customer_phone || null,
        scheduled_date: state.scheduled_date || null,
        scheduled_time: state.scheduled_time || null,
        party_size: Number.isFinite(Number(state.party_size)) ? Number(state.party_size) : null,
        delivery_address: state.delivery_address || null,
        payment_method: state.payment_method || null,
        notes: state.notes === undefined ? null : state.notes,
        note_declined: state.note_declined === true,
        awaiting_field: cloneAwaitingField(state.awaiting_field),
        last_prompt_kind: state.last_prompt_kind || null,
        last_prompt_text: state.last_prompt_text || null,
        updated_at: state.updated_at || null,
    }
}

function getRestaurantState(metadata = {}) {
    return cloneRestaurantState(metadata.restaurant || {})
}

function setRestaurantState(metadata = {}, restaurantState) {
    return {
        ...(metadata || {}),
        restaurant: {
            ...cloneRestaurantState(restaurantState),
            updated_at: new Date().toISOString(),
        }
    }
}

function clearRestaurantState(metadata = {}) {
    return {
        ...(metadata || {}),
        restaurant: null,
    }
}

function hasRestaurantStateData(state = {}) {
    const cloned = cloneRestaurantState(state)
    return Boolean(
        cloned.stage !== RESTAURANT_STAGE.IDLE ||
        cloned.mode ||
        cloned.items.length > 0 ||
        cloned.customer_name ||
        cloned.customer_phone ||
        cloned.scheduled_date ||
        cloned.scheduled_time ||
        cloned.party_size ||
        cloned.delivery_address ||
        cloned.payment_method ||
        cloned.note_declined ||
        cloned.notes
    )
}

function scoreRestaurantProductMatch(searchName, product) {
    const normalizedSearch = normalizeText(searchName)
    const productName = normalizeText(product?.name)
    const productText = normalizeText(`${product?.name || ''} ${product?.description || ''} ${product?.category || ''}`)

    if (!normalizedSearch || !productName) return 0
    if (productName === normalizedSearch) return 100
    if (normalizedSearch.includes(productName) || productName.includes(normalizedSearch)) return 60

    const terms = normalizedSearch.split(/\s+/).filter(term => term.length > 2)
    const nameHits = terms.filter(term => productName.includes(term)).length
    const textHits = terms.filter(term => productText.includes(term)).length

    return nameHits * 12 + textHits * 3
}

function findRestaurantProductByName(products = [], productName) {
    let bestProduct = null
    let bestScore = 0

    for (const product of products) {
        const score = scoreRestaurantProductMatch(productName, product)
        if (score > bestScore) {
            bestProduct = product
            bestScore = score
        }
    }

    return bestScore >= 10 ? bestProduct : null
}

function splitItemSegments(text) {
    return String(text || '')
        .split(/\s*(?:,|\+|;|\bet\b|\bpuis\b)\s*/i)
        .map(segment => String(segment || '').trim())
        .filter(Boolean)
}

function extractQuantityFromSegment(text) {
    const normalized = normalizeText(text)
    if (!normalized) return null

    const startMatch = normalized.match(/^(\d{1,3})(?:\s|$)/)
    if (startMatch) {
        const quantity = Number(startMatch[1])
        if (Number.isFinite(quantity) && quantity > 0) return quantity
    }

    const endMatch = normalized.match(/(?:^|\s)(\d{1,3})$/)
    if (endMatch) {
        const quantity = Number(endMatch[1])
        if (Number.isFinite(quantity) && quantity > 0) return quantity
    }

    const inlineMatch = normalized.match(/\b(\d{1,3})\b/)
    if (inlineMatch) {
        const quantity = Number(inlineMatch[1])
        if (Number.isFinite(quantity) && quantity > 0) return quantity
    }

    return null
}

function extractItemsFromText(text, restaurantProducts = [], currentItems = []) {
    if (!Array.isArray(restaurantProducts) || restaurantProducts.length === 0) {
        return { items: cloneItems(currentItems), captured: [] }
    }

    const nextItems = cloneItems(currentItems)
    const captured = []
    const segments = splitItemSegments(text)
    const inspectedSegments = segments.length > 0 ? segments : [String(text || '')]

    for (const segment of inspectedSegments) {
        const product = findRestaurantProductByName(restaurantProducts, segment)
        if (!product) continue

        const quantity = extractQuantityFromSegment(segment) || 1
        const existingItem = nextItems.find(item => item.product_id === product.id)
        if (existingItem) {
            existingItem.quantity += quantity
            existingItem.line_total_fcfa = Number(product.price_fcfa || 0) * existingItem.quantity
        } else {
            nextItems.push({
                product_id: product.id,
                product_name: product.name,
                quantity,
                unit_price_fcfa: Number(product.price_fcfa || 0),
                line_total_fcfa: Number(product.price_fcfa || 0) * quantity,
                product_category: product.menu_section_slug || product.category || null,
            })
        }

        captured.push({
            type: 'item',
            value: `${quantity}x ${product.name}`
        })
    }

    return { items: nextItems, captured }
}

function extractDates(text) {
    const raw = String(text || '')
    const matches = []

    const isoMatches = raw.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []
    isoMatches.forEach(value => matches.push(value))

    const frMatches = raw.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/g) || []
    frMatches.forEach(value => {
        const [day, month, year] = value.split(/[/-]/)
        matches.push(`${year}-${month}-${day}`)
    })

    return Array.from(new Set(matches))
}

function extractTime(text) {
    const match = String(text || '').match(/\b(\d{1,2})(?:[:hH](\d{2}))\b/)
    if (!match) return null

    const hours = Number(match[1])
    const minutes = Number(match[2] || '00')
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function extractPartySize(text) {
    const normalized = normalizeText(text)
    const patterns = [
        /\b(\d{1,2})\s*(?:personnes?|pers?|adultes?|enfants?|couverts?)\b/,
        /\bnous serons\s+(\d{1,2})\b/,
        /\bpour\s+(\d{1,2})\s+personnes?\b/,
    ]

    for (const pattern of patterns) {
        const match = normalized.match(pattern)
        if (!match) continue

        const size = Number(match[1])
        if (Number.isFinite(size) && size > 0) {
            return size
        }
    }

    return null
}

function extractCustomerPhone(text) {
    const candidates = String(text || '').match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) || []
    for (const candidate of candidates) {
        const normalized = normalizePhoneNumber(candidate)
        if (normalized) return normalized
    }
    return null
}

function extractCustomerName(text, force = false) {
    const raw = String(text || '').trim()
    if (!raw) return null

    const explicitMatch = raw.match(/(?:je m[' ]appelle|mon nom est|moi c[' ]est|c[' ]est)\s+(.+)$/i)
    const source = explicitMatch ? explicitMatch[1] : (force ? raw : null)
    if (!source) return null

    const cleaned = source
        .replace(/[^\p{L}A-Za-z' -]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    if (!cleaned) return null

    const words = cleaned.split(' ').filter(Boolean)
    if (words.length < 1 || words.length > 6) return null
    return cleaned
}

function extractDeliveryAddress(text, force = false) {
    const raw = String(text || '').trim()
    if (!raw) return null

    const mapsLink = raw.match(/https?:\/\/(maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.com\/maps)[^\s]*/i)
    if (mapsLink) return mapsLink[0]

    const normalized = normalizeText(raw)
    if (!force && !/(adresse|livraison|quartier|avenue|rue|boulevard|commune|immeuble|maison|appartement)/.test(normalized)) {
        return null
    }

    const cleaned = raw.replace(/\s+/g, ' ').trim()
    return cleaned.length >= 8 ? cleaned : null
}

function detectFulfillmentMode(text, hasItems = false, currentMode = null) {
    const normalized = normalizeText(text)
    if (!normalized) return currentMode

    if (/(livraison|livrer|a domicile|chez moi)/.test(normalized)) return 'delivery'
    if (/(emporter|a emporter|retrait|retirer|takeaway)/.test(normalized)) return 'takeaway'
    if (/(sur place|manger sur place|surplace|au restaurant)/.test(normalized)) return 'dine_in'

    if (/\b(reserver|reservation|table)\b/.test(normalized)) {
        return hasItems ? 'dine_in' : 'booking_only'
    }

    if (currentMode === 'booking_only' && hasItems) {
        return 'dine_in'
    }

    return currentMode
}

function detectRestaurantPaymentMethod(text, mode) {
    const normalized = normalizeText(text)
    if (!normalized) return null

    if (/(en ligne|online|payer maintenant|mobile money|carte)/.test(normalized)) {
        return 'online'
    }

    if (mode === 'dine_in' || mode === 'booking_only') {
        if (/(sur place|onsite|a l arrivee|a l'arrivee)/.test(normalized)) {
            return 'onsite'
        }
    } else {
        if (/(sur place|au retrait|a la livraison|cash|cod)/.test(normalized)) {
            return 'onsite'
        }
    }

    return null
}

function buildAwaitingField(state) {
    if (!state.mode) {
        return {
            type: 'mode',
            label: 'mode de commande',
            prompt: 'Souhaitez-vous manger sur place, reserver sans commande, emporter ou livraison ?'
        }
    }

    if ((state.mode === 'takeaway' || state.mode === 'delivery') && state.items.length === 0) {
        return {
            type: 'items',
            label: 'articles',
            prompt: 'Quels plats ou boissons souhaitez-vous commander ?'
        }
    }

    if ((state.mode === 'dine_in' || state.mode === 'booking_only') && !state.scheduled_date) {
        return {
            type: 'scheduled_date',
            label: 'date',
            prompt: 'Pour quelle date souhaitez-vous reserver ? (format conseille: YYYY-MM-DD)'
        }
    }

    if ((state.mode === 'dine_in' || state.mode === 'booking_only') && !state.scheduled_time) {
        return {
            type: 'scheduled_time',
            label: 'heure',
            prompt: 'A quelle heure souhaitez-vous venir ? (format conseille: HH:MM)'
        }
    }

    if ((state.mode === 'dine_in' || state.mode === 'booking_only') && !state.party_size) {
        return {
            type: 'party_size',
            label: 'nombre de personnes',
            prompt: 'Pour combien de personnes ?'
        }
    }

    if (state.mode === 'delivery' && !state.delivery_address) {
        return {
            type: 'delivery_address',
            label: 'adresse de livraison',
            prompt: 'Quelle est l adresse de livraison complete ?'
        }
    }

    if (!state.customer_name) {
        return {
            type: 'customer_name',
            label: 'nom complet',
            prompt: 'Quel est votre nom complet ?'
        }
    }

    if (!state.customer_phone) {
        return {
            type: 'customer_phone',
            label: 'numero de telephone',
            prompt: 'Quel est votre numero de telephone avec indicatif pays ?'
        }
    }

    if (!state.payment_method) {
        return {
            type: 'payment_method',
            label: 'mode de paiement',
            prompt: state.mode === 'delivery'
                ? 'Souhaitez-vous payer en ligne ou a la livraison ?'
                : state.mode === 'takeaway'
                    ? 'Souhaitez-vous payer en ligne ou au retrait ?'
                    : 'Souhaitez-vous payer en ligne ou sur place ?'
        }
    }

    if (state.notes === null && !state.note_declined) {
        return {
            type: 'notes',
            label: 'notes',
            prompt: 'Avez-vous une demande particuliere a ajouter ?'
        }
    }

    return null
}

function formatModeLabel(mode) {
    switch (mode) {
        case 'dine_in': return 'Sur place'
        case 'booking_only': return 'Reservation simple'
        case 'takeaway': return 'A emporter'
        case 'delivery': return 'Livraison'
        default: return 'Non defini'
    }
}

function formatPaymentLabel(paymentMethod, mode) {
    if (paymentMethod === 'online') return 'En ligne'
    if (paymentMethod === 'onsite') {
        if (mode === 'delivery') return 'A la livraison'
        if (mode === 'takeaway') return 'Au retrait'
        return 'Sur place'
    }
    return 'Non defini'
}

function buildCapturedSummary(captured = []) {
    if (!captured.length) return ''

    const parts = captured.map(item => {
        if (item.type === 'item') return item.value
        if (item.type === 'mode') return `le mode ${formatModeLabel(item.value).toLowerCase()}`
        if (item.type === 'scheduled_date') return `la date ${item.value}`
        if (item.type === 'scheduled_time') return `l heure ${item.value}`
        if (item.type === 'party_size') return `${item.value} personne(s)`
        if (item.type === 'customer_name') return `le nom ${item.value}`
        if (item.type === 'customer_phone') return `le telephone ${item.value}`
        if (item.type === 'delivery_address') return `l adresse ${item.value}`
        if (item.type === 'payment_method') return `le paiement ${formatPaymentLabel(item.value)}`
        if (item.type === 'notes') return `la note "${item.value}"`
        return item.value
    })

    if (parts.length === 1) return `Parfait, ${parts[0]}.`
    if (parts.length === 2) return `Parfait, ${parts[0]} et ${parts[1]}.`
    return `Parfait, ${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}.`
}

function buildRestaurantRecap(state) {
    const lines = ['Voici le recapitulatif de votre demande :', '']

    lines.push(`- Mode : ${formatModeLabel(state.mode)}`)

    if (state.items.length > 0) {
        lines.push(`- Articles : ${state.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}`)
        const total = state.items.reduce((sum, item) => {
            if (Number.isFinite(Number(item.line_total_fcfa))) return sum + Number(item.line_total_fcfa)
            if (Number.isFinite(Number(item.unit_price_fcfa))) return sum + (Number(item.unit_price_fcfa) * Number(item.quantity || 0))
            return sum
        }, 0)
        if (total > 0) {
            lines.push(`- Total estime : ${total.toLocaleString('fr-FR')} FCFA`)
        }
    }

    if (state.scheduled_date) lines.push(`- Date : ${state.scheduled_date}`)
    if (state.scheduled_time) lines.push(`- Heure : ${state.scheduled_time}`)
    if (state.party_size) lines.push(`- Personnes : ${state.party_size}`)
    if (state.delivery_address) lines.push(`- Adresse : ${state.delivery_address}`)
    if (state.customer_name) lines.push(`- Nom : ${state.customer_name}`)
    if (state.customer_phone) lines.push(`- Telephone : ${state.customer_phone}`)
    if (state.payment_method) lines.push(`- Paiement : ${formatPaymentLabel(state.payment_method, state.mode)}`)

    if (state.note_declined) {
        lines.push('- Notes : aucune')
    } else if (state.notes) {
        lines.push(`- Notes : ${state.notes}`)
    }

    lines.push('', 'Confirmez-vous ?')
    return lines.join('\n')
}

function buildStructuredRestaurantReply(state, captured = []) {
    if (state.stage === RESTAURANT_STAGE.RECAP) {
        return buildRestaurantRecap(state)
    }

    const acknowledgement = buildCapturedSummary(captured)
    return [acknowledgement, state.awaiting_field?.prompt].filter(Boolean).join(' ')
}

function isPositiveReply(text) {
    const normalized = normalizeText(text)
    return ['oui', 'ok', 'okay', 'daccord', "d'accord", 'je confirme', 'confirme', 'cest bon', "c'est bon"].includes(normalized)
}

function isNegativeReply(text) {
    const normalized = normalizeText(text)
    return ['non', 'modifier', 'je veux modifier', 'corriger', 'je corrige', 'pas maintenant'].includes(normalized)
}

function updateRestaurantStateFromUserMessage(previousState, text, restaurantProducts = []) {
    const state = cloneRestaurantState(previousState)
    const normalized = normalizeText(text)
    const captured = []

    if (!normalized) {
        return { state, captured, stateChanged: false, shouldBypassAI: false, directReply: null }
    }

    if (state.awaiting_field?.type === 'notes' && ['non', 'aucune', 'aucun', 'rien', 'ras'].includes(normalized)) {
        state.note_declined = true
        state.notes = null
        state.awaiting_field = buildAwaitingField(state)
        state.stage = state.awaiting_field ? RESTAURANT_STAGE.COLLECTING : RESTAURANT_STAGE.RECAP
        state.last_prompt_kind = state.stage
        state.last_prompt_text = normalized
        return {
            state,
            captured,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: buildStructuredRestaurantReply(state, [])
        }
    }

    if (state.stage === RESTAURANT_STAGE.RECAP && isPositiveReply(normalized)) {
        state.stage = RESTAURANT_STAGE.READY
        state.awaiting_field = null
        state.last_prompt_kind = RESTAURANT_STAGE.READY
        state.last_prompt_text = normalized
        return { state, captured, stateChanged: true, shouldBypassAI: false, directReply: null }
    }

    if (state.stage === RESTAURANT_STAGE.RECAP && isNegativeReply(normalized)) {
        state.stage = RESTAURANT_STAGE.COLLECTING
        state.awaiting_field = {
            type: 'free_edit',
            label: 'modification',
            prompt: 'D accord. Dites-moi ce que vous souhaitez modifier.'
        }
        state.last_prompt_kind = RESTAURANT_STAGE.COLLECTING
        state.last_prompt_text = normalized
        return {
            state,
            captured,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: state.awaiting_field.prompt
        }
    }

    const previousAwaiting = cloneAwaitingField(state.awaiting_field)
    const previousMode = state.mode
    const previousSignature = JSON.stringify(state)

    const itemResult = extractItemsFromText(text, restaurantProducts, state.items)
    if (itemResult.captured.length > 0) {
        state.items = itemResult.items
        captured.push(...itemResult.captured)
    }

    const detectedMode = detectFulfillmentMode(text, state.items.length > 0, state.mode)
    if (detectedMode && detectedMode !== state.mode) {
        state.mode = detectedMode
        captured.push({ type: 'mode', value: detectedMode })
    }

    if (state.mode === 'booking_only' && state.items.length > 0) {
        state.mode = 'dine_in'
    }

    const shouldStartFlow = hasRestaurantStateData(state) ||
        itemResult.captured.length > 0 ||
        (!!detectedMode && detectedMode !== previousMode)

    if (!shouldStartFlow) {
        return { state, captured: [], stateChanged: false, shouldBypassAI: false, directReply: null }
    }

    const dates = extractDates(text)
    if (!state.scheduled_date && dates[0]) {
        state.scheduled_date = dates[0]
        captured.push({ type: 'scheduled_date', value: dates[0] })
    }

    if (!state.scheduled_time) {
        const extractedTime = extractTime(text)
        if (extractedTime) {
            state.scheduled_time = extractedTime
            captured.push({ type: 'scheduled_time', value: extractedTime })
        }
    }

    if (!state.party_size) {
        const extractedPartySize = extractPartySize(text)
        if (extractedPartySize) {
            state.party_size = extractedPartySize
            captured.push({ type: 'party_size', value: extractedPartySize })
        }
    }

    if (!state.customer_phone) {
        const extractedPhone = extractCustomerPhone(text)
        if (extractedPhone) {
            state.customer_phone = extractedPhone
            captured.push({ type: 'customer_phone', value: extractedPhone })
        }
    }

    if (!state.customer_name) {
        const extractedName = extractCustomerName(text, state.awaiting_field?.type === 'customer_name' || state.awaiting_field?.type === 'free_edit')
        if (extractedName) {
            state.customer_name = extractedName
            captured.push({ type: 'customer_name', value: extractedName })
        }
    }

    if (state.mode === 'delivery' && !state.delivery_address) {
        const extractedAddress = extractDeliveryAddress(text, state.awaiting_field?.type === 'delivery_address' || state.awaiting_field?.type === 'free_edit')
        if (extractedAddress) {
            state.delivery_address = extractedAddress
            captured.push({ type: 'delivery_address', value: extractedAddress })
        }
    }

    if (!state.payment_method) {
        const extractedPaymentMethod = detectRestaurantPaymentMethod(text, state.mode)
        if (extractedPaymentMethod) {
            state.payment_method = extractedPaymentMethod
            captured.push({ type: 'payment_method', value: extractedPaymentMethod })
        }
    }

    if ((state.awaiting_field?.type === 'notes' || state.awaiting_field?.type === 'free_edit') && !state.note_declined && state.notes === null) {
        const trimmed = String(text || '').trim()
        if (trimmed && !isPositiveReply(trimmed) && !isNegativeReply(trimmed)) {
            state.notes = trimmed
            captured.push({ type: 'notes', value: trimmed })
        }
    }

    state.awaiting_field = buildAwaitingField(state)
    state.stage = state.awaiting_field ? RESTAURANT_STAGE.COLLECTING : RESTAURANT_STAGE.RECAP
    state.last_prompt_kind = state.stage
    state.last_prompt_text = normalized

    const awaitingChanged = JSON.stringify(previousAwaiting) !== JSON.stringify(state.awaiting_field)
    const stateChanged = previousSignature !== JSON.stringify(state)
    const shouldBypassAI = stateChanged || awaitingChanged

    return {
        state,
        captured,
        stateChanged,
        shouldBypassAI,
        directReply: shouldBypassAI ? buildStructuredRestaurantReply(state, captured) : null,
    }
}

function inferRestaurantStateFromAssistantMessage(content, previousState = {}) {
    const state = cloneRestaurantState(previousState)
    const normalized = normalizeText(content)
    if (!normalized) return state

    if (/reservation restaurant enregistree|reservation de table enregistree|commande restaurant enregistree/.test(normalized)) {
        return cloneRestaurantState({})
    }

    if (/confirmez-vous/.test(normalized) && hasRestaurantStateData(state)) {
        state.stage = RESTAURANT_STAGE.RECAP
        state.awaiting_field = null
        state.last_prompt_kind = RESTAURANT_STAGE.RECAP
        state.last_prompt_text = content
        return state
    }

    return state
}

function buildRestaurantStateGuidance(restaurantState = {}) {
    const state = cloneRestaurantState(restaurantState)
    if (!hasRestaurantStateData(state)) return ''

    const lines = ['RESTAURANT STATE (source systeme, prioritaire):']

    if (state.mode) lines.push(`- Mode deja choisi: ${state.mode}`)
    if (state.items.length > 0) {
        lines.push(`- Articles deja collectes: ${state.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}`)
    }
    if (state.scheduled_date) lines.push(`- Date deja collectee: ${state.scheduled_date}`)
    if (state.scheduled_time) lines.push(`- Heure deja collectee: ${state.scheduled_time}`)
    if (state.party_size) lines.push(`- Nombre de personnes deja collecte: ${state.party_size}`)
    if (state.delivery_address) lines.push(`- Adresse deja collectee: ${state.delivery_address}`)
    if (state.customer_name) lines.push(`- Nom deja collecte: ${state.customer_name}`)
    if (state.customer_phone) lines.push(`- Telephone deja collecte: ${state.customer_phone}`)
    if (state.payment_method) lines.push(`- Paiement deja choisi: ${formatPaymentLabel(state.payment_method, state.mode)}`)
    if (state.note_declined) lines.push('- Le client ne souhaite pas ajouter de note.')
    else if (state.notes) lines.push(`- Note deja collectee: ${state.notes}`)
    if (state.awaiting_field?.label) lines.push(`- Champ bloquant actuel: ${state.awaiting_field.label}`)

    if (state.stage === RESTAURANT_STAGE.READY) {
        lines.push('- Le client vient de confirmer le recapitulatif.')
        lines.push('- Si toutes les informations requises sont presentes, appelle create_restaurant_checkout maintenant.')
        lines.push('- Ne pose pas une nouvelle question avant l appel tool.')
    } else {
        lines.push('- Ne redemande jamais les informations deja collectees.')
        lines.push('- Si le client donne une information utile hors ordre, memorise-la.')
    }

    return lines.join('\n')
}

function mergeRestaurantStateIntoToolArgs(functionName, args = {}, restaurantState = {}) {
    if (functionName !== 'create_restaurant_checkout') return args

    const state = cloneRestaurantState(restaurantState)
    if (!hasRestaurantStateData(state)) return args

    const mergedItems = Array.isArray(args.items) && args.items.length > 0
        ? args.items
        : state.items.map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
        }))

    return {
        ...args,
        fulfillment_mode: args.fulfillment_mode || state.mode || args.fulfillment_mode,
        items: mergedItems,
        customer_name: args.customer_name || state.customer_name || args.customer_name,
        customer_phone: args.customer_phone || state.customer_phone || args.customer_phone,
        scheduled_date: args.scheduled_date || state.scheduled_date || args.scheduled_date,
        scheduled_time: args.scheduled_time || state.scheduled_time || args.scheduled_time,
        party_size: args.party_size || state.party_size || args.party_size,
        delivery_address: args.delivery_address || state.delivery_address || args.delivery_address,
        payment_method: args.payment_method || state.payment_method || args.payment_method,
        notes: args.notes !== undefined ? args.notes : state.notes,
    }
}

module.exports = {
    RESTAURANT_STAGE,
    buildRestaurantStateGuidance,
    clearRestaurantState,
    getRestaurantState,
    hasRestaurantStateData,
    inferRestaurantStateFromAssistantMessage,
    mergeRestaurantStateIntoToolArgs,
    setRestaurantState,
    updateRestaurantStateFromUserMessage,
}
