const {
    getOptionValue,
    normalizePhoneNumber,
    normalizeWhatsAppContact,
} = require('../ai/tools/tool-helpers')
const {
    calculateServiceBookingPrice,
    getVariantDisplayName,
} = require('../ai/tools/service-pricing')
const {
    bookingTypeNeedsEndDate,
    bookingTypeNeedsPartySize,
    bookingTypeNeedsPaymentChoice,
    bookingTypeNeedsTime,
    formatBookingPaymentLabel,
    normalizeBookingPaymentMethod,
    normalizeBookingType,
} = require('./booking-utils')

const BOOKING_STAGE = {
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

function isPositiveReply(text) {
    const normalized = normalizeText(text)
    return ['oui', 'ok', 'okay', 'daccord', "d'accord", 'confirmer', 'je confirme', "c'est bon", 'cest bon'].includes(normalized)
}

function isNegativeReply(text) {
    const normalized = normalizeText(text)
    return ['non', 'pas maintenant', 'aucune', 'aucun', 'rien', 'ras'].includes(normalized)
}

function cloneBooking(booking = null) {
    if (!booking) return null

    return {
        service_id: booking.service_id || null,
        service_name: booking.service_name || null,
        service_subtype: booking.service_subtype || 'other',
        selected_variants: { ...(booking.selected_variants || {}) },
        selected_variants_by_id: { ...(booking.selected_variants_by_id || {}) },
        selected_supplements: { ...(booking.selected_supplements || {}) },
        selected_supplements_by_id: { ...(booking.selected_supplements_by_id || {}) },
        skipped_optional_variant_ids: Array.isArray(booking.skipped_optional_variant_ids)
            ? [...booking.skipped_optional_variant_ids]
            : [],
        preferred_date: booking.preferred_date || null,
        preferred_time: booking.preferred_time || null,
        end_date: booking.end_date || null,
        party_size: booking.party_size ? Number(booking.party_size) : null,
        customer_name: booking.customer_name || null,
        customer_phone: booking.customer_phone || null,
        payment_method: booking.payment_method || null,
        notes: booking.notes === undefined ? null : booking.notes,
        note_declined: booking.note_declined === true,
    }
}

function cloneAwaitingField(field = null) {
    if (!field) return null
    return { ...field }
}

function cloneBookingState(bookingState = {}) {
    return {
        stage: bookingState.stage || BOOKING_STAGE.IDLE,
        current_booking: cloneBooking(bookingState.current_booking),
        awaiting_field: cloneAwaitingField(bookingState.awaiting_field),
        last_prompt_kind: bookingState.last_prompt_kind || null,
        last_prompt_text: bookingState.last_prompt_text || null,
        updated_at: bookingState.updated_at || null,
    }
}

function getBookingState(metadata = {}) {
    return cloneBookingState(metadata.booking || {})
}

function setBookingState(metadata = {}, bookingState) {
    return {
        ...(metadata || {}),
        booking: {
            ...cloneBookingState(bookingState),
            updated_at: new Date().toISOString(),
        }
    }
}

function clearBookingState(metadata = {}) {
    return {
        ...(metadata || {}),
        booking: null,
    }
}

function findServiceById(services = [], serviceId) {
    return (services || []).find(service => service.id === serviceId) || null
}

function findBestService(services = [], text) {
    const normalized = normalizeText(text)
    if (!normalized) return null

    const numericChoice = normalized.match(/^\d+$/)
    if (numericChoice) {
        const index = Number(numericChoice[0]) - 1
        if (services[index]) return services[index]
    }

    let bestService = null
    let bestScore = 0

    for (const service of services) {
        const serviceName = normalizeText(service.name)
        if (!serviceName) continue

        let score = 0
        if (normalized === serviceName) score = 120
        else if (normalized.includes(serviceName) || serviceName.includes(normalized)) score = 70
        else {
            const terms = normalized.split(' ').filter(term => term.length > 2)
            score = terms.filter(term => serviceName.includes(term)).length * 15
        }

        if (score > bestScore) {
            bestScore = score
            bestService = service
        }
    }

    return bestScore >= 30 ? bestService : null
}

function getRequiredServiceVariants(service) {
    return (service?.variants || [])
        .filter(variant =>
            Array.isArray(variant.options) &&
            variant.options.length > 0 &&
            variant.type === 'fixed'
        )
        .map(variant => ({
            ...variant,
            label: getVariantDisplayName(variant),
        }))
}

function getOptionalServiceVariants(service) {
    return (service?.variants || [])
        .filter(variant =>
            Array.isArray(variant.options) &&
            variant.options.length > 0 &&
            (variant.type === 'additive' || variant.type === 'supplement')
        )
        .map(variant => ({
            ...variant,
            label: getVariantDisplayName(variant),
        }))
}

function getSelectedVariantValue(booking, variantId) {
    return booking?.selected_variants_by_id?.[variantId] || null
}

function getSelectedSupplementValue(booking, variantId) {
    return booking?.selected_supplements_by_id?.[variantId] || null
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

function setSelectedVariant(booking, variant, value) {
    booking.selected_variants = {
        ...(booking.selected_variants || {}),
        [getVariantDisplayName(variant)]: value,
    }
    booking.selected_variants_by_id = {
        ...(booking.selected_variants_by_id || {}),
        [variant.id]: value,
    }
}

function setSelectedSupplement(booking, variant, value) {
    booking.selected_supplements = {
        ...(booking.selected_supplements || {}),
        [value]: true,
    }
    booking.selected_supplements_by_id = {
        ...(booking.selected_supplements_by_id || {}),
        [variant.id]: value,
    }
}

function extractSelectionsFromText(service, text, currentBooking) {
    const normalized = normalizeText(text)
    const booking = cloneBooking(currentBooking)
    const captured = []

    if (!service || !normalized || !booking) {
        return { booking, captured }
    }

    for (const variant of getRequiredServiceVariants(service)) {
        if (getSelectedVariantValue(booking, variant.id)) continue
        const option = findStrictVariantOption(variant, normalized)
        if (!option) continue

        const value = getOptionValue(option)
        setSelectedVariant(booking, variant, value)
        captured.push({ type: 'variant', label: variant.label, value })
    }

    for (const variant of getOptionalServiceVariants(service)) {
        if (getSelectedSupplementValue(booking, variant.id)) continue
        const option = findStrictVariantOption(variant, normalized)
        if (!option) continue

        const value = getOptionValue(option)
        setSelectedSupplement(booking, variant, value)
        captured.push({ type: 'supplement', label: variant.label, value })
    }

    return { booking, captured }
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
        /\b(\d{1,2})\s*(?:personnes?|pers?|adultes?|enfants?|voyageurs?|couverts?)\b/,
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

function extractCustomerName(text) {
    const cleaned = String(text || '').replace(/\d/g, ' ').replace(/\s+/g, ' ').trim()
    if (!cleaned) return null
    const words = cleaned.split(' ').filter(Boolean)
    if (words.length === 0 || words.length > 6) return null
    return cleaned
}

function extractCustomerPhone(text) {
    const candidates = String(text || '').match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) || []
    for (const candidate of candidates) {
        const normalized = normalizePhoneNumber(candidate)
        if (normalized) return normalized
    }

    return normalizeWhatsAppContact(text)
}

function serviceNeedsTime(service) {
    return bookingTypeNeedsTime(normalizeBookingType(null, service?.service_subtype))
}

function serviceNeedsEndDate(service) {
    return bookingTypeNeedsEndDate(normalizeBookingType(null, service?.service_subtype))
}

function serviceNeedsPartySize(service) {
    return bookingTypeNeedsPartySize(normalizeBookingType(null, service?.service_subtype))
}

function serviceNeedsPaymentChoice(service) {
    return bookingTypeNeedsPaymentChoice(normalizeBookingType(null, service?.service_subtype))
}

function detectBookingPaymentMethod(text) {
    return normalizeBookingPaymentMethod(text)
}

function buildAwaitingField(service, booking) {
    if (!service || !booking) return null

    for (const variant of getRequiredServiceVariants(service)) {
        if (getSelectedVariantValue(booking, variant.id)) continue

        const options = (variant.options || [])
            .map(option => getOptionValue(option))
            .filter(Boolean)
            .join(', ')

        return {
            type: 'variant',
            variant_id: variant.id,
            label: variant.label,
            prompt: `Quelle ${variant.label.toLowerCase()} souhaitez-vous ?${options ? ` (${options})` : ''}`
        }
    }

    for (const variant of getOptionalServiceVariants(service)) {
        const skipped = Array.isArray(booking.skipped_optional_variant_ids) && booking.skipped_optional_variant_ids.includes(variant.id)
        if (skipped || getSelectedSupplementValue(booking, variant.id)) continue

        const options = (variant.options || [])
            .map(option => getOptionValue(option))
            .filter(Boolean)
            .join(', ')

        return {
            type: 'optional_variant',
            variant_id: variant.id,
            label: variant.label,
            prompt: `Souhaitez-vous ajouter ${variant.label.toLowerCase()} ?${options ? ` (${options})` : ''}`
        }
    }

    if (!booking.preferred_date) {
        return {
            type: 'preferred_date',
            label: 'date',
            prompt: serviceNeedsEndDate(service)
                ? 'Pour quelles dates ? Donnez la date de debut puis la date de fin au format YYYY-MM-DD.'
                : 'Pour quelle date ? (format conseille: YYYY-MM-DD)'
        }
    }

    if (serviceNeedsEndDate(service) && !booking.end_date) {
        return {
            type: 'end_date',
            label: 'date de fin',
            prompt: 'Quelle est la date de fin ? (format conseille: YYYY-MM-DD)'
        }
    }

    if (serviceNeedsTime(service) && !booking.preferred_time) {
        return {
            type: 'preferred_time',
            label: 'heure',
            prompt: 'A quelle heure souhaitez-vous reserver ? (format conseille: HH:MM)'
        }
    }

    if (serviceNeedsPartySize(service) && !booking.party_size) {
        return {
            type: 'party_size',
            label: 'nombre de personnes',
            prompt: 'Combien de personnes sont concernees ?'
        }
    }

    if (booking.notes === null && !booking.note_declined) {
        return {
            type: 'notes',
            label: 'demandes particulieres',
            prompt: 'Avez-vous des demandes particulieres ?'
        }
    }

    if (!booking.customer_name) {
        return {
            type: 'customer_name',
            label: 'nom complet',
            prompt: 'Quel est votre nom complet ?'
        }
    }

    if (!booking.customer_phone) {
        return {
            type: 'customer_phone',
            label: 'numero de telephone',
            prompt: 'Quel est votre numero de telephone avec indicatif pays ?'
        }
    }

    if (serviceNeedsPaymentChoice(service) && !booking.payment_method) {
        return {
            type: 'payment_method',
            label: 'mode de paiement',
            prompt: service?.service_subtype === 'rental'
                ? 'Souhaitez-vous payer en ligne ou au retrait ?'
                : 'Souhaitez-vous payer en ligne ou sur place ?'
        }
    }

    return null
}

function buildCapturedSummary(captured = []) {
    if (!captured.length) return ''

    const parts = captured.map(item => {
        if (item.type === 'variant') return `${item.label.toLowerCase()} ${item.value}`
        if (item.type === 'supplement') return `${item.label.toLowerCase()} ${item.value}`
        if (item.type === 'preferred_date') return `la date ${item.value}`
        if (item.type === 'end_date') return `la date de fin ${item.value}`
        if (item.type === 'preferred_time') return `l'heure ${item.value}`
        if (item.type === 'party_size') return `${item.value} personne(s)`
        if (item.type === 'customer_name') return `le nom ${item.value}`
        if (item.type === 'customer_phone') return `le telephone ${item.value}`
        if (item.type === 'payment_method') return `le paiement ${formatBookingPaymentLabel(item.value)}`
        if (item.type === 'notes') return `la note "${item.value}"`
        return item.value
    })

    if (parts.length === 1) return `Je note ${parts[0]}.`
    if (parts.length === 2) return `Je note ${parts[0]} et ${parts[1]}.`
    return `Je note ${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}.`
}

function buildBookingRecapLegacy(service, booking) {
    const pricing = calculateServiceBookingPrice(service, {
        selectedVariantsMap: booking.selected_variants,
        selectedSupplementsMap: booking.selected_supplements,
        bookingType: normalizeBookingType(null, booking.service_subtype || service?.service_subtype),
        serviceSubtype: booking.service_subtype || service?.service_subtype,
        preferredDate: booking.preferred_date,
        endDate: booking.end_date,
    })

    const lines = ['Voici le recapitulatif de votre reservation :', '', `• ${booking.service_name}`]

    if (pricing.fixedSelections.length > 0) {
        lines.push(`• Variantes : ${pricing.fixedSelections.map(item => `${item.label} ${item.value}`).join(', ')}`)
    }

    if (pricing.supplementsList.length > 0) {
        lines.push(`• Supplements : ${pricing.supplementsList.map(item => item.value).join(', ')}`)
    }

    if (booking.preferred_date) {
        lines.push(`• Date : ${booking.preferred_date}`)
    }
    if (booking.end_date) {
        lines.push(`• Fin : ${booking.end_date}`)
    }
    if (booking.preferred_time) {
        lines.push(`• Heure : ${booking.preferred_time}`)
    }
    if (booking.party_size) {
        lines.push(`• Personnes : ${booking.party_size}`)
    }
    if (pricing.price > 0) {
        lines.push(`• Prix : ${pricing.price.toLocaleString('fr-FR')} FCFA`)
    }
    if (booking.customer_name) {
        lines.push(`• Nom : ${booking.customer_name}`)
    }
    if (booking.customer_phone) {
        lines.push(`• Telephone : ${booking.customer_phone}`)
    }
    if (booking.note_declined) {
        lines.push('• Notes : aucune')
    } else if (booking.notes) {
        lines.push(`• Notes : ${booking.notes}`)
    }

    if (pricing.nights) {
        lines.push(`â€¢ Duree : ${pricing.nights} nuit${pricing.nights > 1 ? 's' : ''}`)
    }
    if (booking.payment_method) {
        lines.push(`â€¢ Paiement : ${formatBookingPaymentLabel(booking.payment_method)}`)
    }

    const cleanedLines = lines.filter(line => !String(line).startsWith('Ã¢â‚¬Â¢'))
    if (cleanedLines.length !== lines.length) {
        lines.length = 0
        lines.push(...cleanedLines)
    }
    if (pricing.nights && !lines.some(line => String(line).includes('Duree :'))) {
        lines.push(`- Duree : ${pricing.nights} nuit${pricing.nights > 1 ? 's' : ''}`)
    }
    if (booking.payment_method && !lines.some(line => String(line).includes('Paiement :'))) {
        lines.push(`- Paiement : ${formatBookingPaymentLabel(booking.payment_method)}`)
    }

    lines.push('', 'Confirmez-vous ?')
    return lines.join('\n')
}

function buildBookingRecap(service, booking) {
    const pricing = calculateServiceBookingPrice(service, {
        selectedVariantsMap: booking.selected_variants,
        selectedSupplementsMap: booking.selected_supplements,
        bookingType: normalizeBookingType(null, booking.service_subtype || service?.service_subtype),
        serviceSubtype: booking.service_subtype || service?.service_subtype,
        preferredDate: booking.preferred_date,
        endDate: booking.end_date,
    })

    const lines = ['Voici le recapitulatif de votre reservation :', '', `- ${booking.service_name}`]

    if (pricing.fixedSelections.length > 0) {
        lines.push(`- Variantes : ${pricing.fixedSelections.map(item => `${item.label} ${item.value}`).join(', ')}`)
    }

    if (pricing.supplementsList.length > 0) {
        lines.push(`- Supplements : ${pricing.supplementsList.map(item => item.value).join(', ')}`)
    }

    if (booking.preferred_date) {
        lines.push(`- Date : ${booking.preferred_date}`)
    }
    if (booking.end_date) {
        lines.push(`- Fin : ${booking.end_date}`)
    }
    if (pricing.nights) {
        lines.push(`- Duree : ${pricing.nights} nuit${pricing.nights > 1 ? 's' : ''}`)
    }
    if (booking.preferred_time) {
        lines.push(`- Heure : ${booking.preferred_time}`)
    }
    if (booking.party_size) {
        lines.push(`- Personnes : ${booking.party_size}`)
    }
    if (booking.payment_method) {
        lines.push(`- Paiement : ${formatBookingPaymentLabel(booking.payment_method)}`)
    }
    if (pricing.price > 0) {
        lines.push(`- Prix : ${pricing.price.toLocaleString('fr-FR')} FCFA`)
    }
    if (booking.customer_name) {
        lines.push(`- Nom : ${booking.customer_name}`)
    }
    if (booking.customer_phone) {
        lines.push(`- Telephone : ${booking.customer_phone}`)
    }
    if (booking.note_declined) {
        lines.push('- Notes : aucune')
    } else if (booking.notes) {
        lines.push(`- Notes : ${booking.notes}`)
    }

    lines.push('', 'Confirmez-vous ?')
    return lines.join('\n')
}

function buildStructuredBookingReply(state, services, captured = []) {
    const service = findServiceById(services, state.current_booking?.service_id)
    if (!service || !state.current_booking) return null

    if (state.stage === BOOKING_STAGE.RECAP) {
        return buildBookingRecap(service, state.current_booking)
    }

    const awaitingField = buildAwaitingField(service, state.current_booking)
    if (!awaitingField) {
        return buildBookingRecap(service, state.current_booking)
    }

    const acknowledgement = buildCapturedSummary(captured)
    return [acknowledgement, awaitingField.prompt].filter(Boolean).join(' ')
}

function updateBookingStateFromUserMessage(previousState, text, services = []) {
    const state = cloneBookingState(previousState)
    const normalized = normalizeText(text)
    const captured = []

    if (!normalized) {
        return { state, captured, stateChanged: false, shouldBypassAI: false, directReply: null }
    }

    if (state.awaiting_field?.type === 'optional_variant' && isNegativeReply(normalized) && state.current_booking) {
        state.current_booking.skipped_optional_variant_ids = Array.from(new Set([
            ...(state.current_booking.skipped_optional_variant_ids || []),
            state.awaiting_field.variant_id,
        ]))
        state.awaiting_field = buildAwaitingField(findServiceById(services, state.current_booking.service_id), state.current_booking)
        state.stage = state.awaiting_field ? BOOKING_STAGE.COLLECTING : BOOKING_STAGE.RECAP
        state.last_prompt_kind = state.stage
        state.last_prompt_text = normalized

        return {
            state,
            captured,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: buildStructuredBookingReply(state, services, []),
        }
    }

    if (state.awaiting_field?.type === 'notes' && isNegativeReply(normalized) && state.current_booking) {
        state.current_booking.notes = ''
        state.current_booking.note_declined = true
        state.awaiting_field = buildAwaitingField(findServiceById(services, state.current_booking.service_id), state.current_booking)
        state.stage = state.awaiting_field ? BOOKING_STAGE.COLLECTING : BOOKING_STAGE.RECAP
        state.last_prompt_kind = state.stage
        state.last_prompt_text = normalized

        return {
            state,
            captured,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: buildStructuredBookingReply(state, services, []),
        }
    }

    if (state.stage === BOOKING_STAGE.RECAP && isPositiveReply(normalized)) {
        state.stage = BOOKING_STAGE.READY
        state.awaiting_field = null
        state.last_prompt_kind = BOOKING_STAGE.READY
        state.last_prompt_text = normalized
        return { state, captured, stateChanged: true, shouldBypassAI: false, directReply: null }
    }

    if (state.stage === BOOKING_STAGE.RECAP && isNegativeReply(normalized)) {
        state.stage = BOOKING_STAGE.COLLECTING
        state.awaiting_field = buildAwaitingField(findServiceById(services, state.current_booking?.service_id), state.current_booking)
        state.last_prompt_kind = BOOKING_STAGE.COLLECTING
        state.last_prompt_text = normalized
        return {
            state,
            captured,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: 'D accord. Dites-moi ce que vous souhaitez modifier sur cette reservation.',
        }
    }

    if (!state.current_booking) {
        const detectedService = findBestService(services, normalized)
        if (detectedService) {
            state.current_booking = {
                service_id: detectedService.id,
                service_name: detectedService.name,
                service_subtype: detectedService.service_subtype || 'other',
                selected_variants: {},
                selected_variants_by_id: {},
                selected_supplements: {},
                selected_supplements_by_id: {},
                skipped_optional_variant_ids: [],
                preferred_date: null,
                preferred_time: null,
                end_date: null,
                party_size: null,
                customer_name: null,
                customer_phone: null,
                payment_method: null,
                notes: null,
                note_declined: false,
            }
            state.awaiting_field = buildAwaitingField(detectedService, state.current_booking)
            state.stage = state.awaiting_field ? BOOKING_STAGE.COLLECTING : BOOKING_STAGE.RECAP
            state.last_prompt_kind = state.stage
            state.last_prompt_text = normalized

            return {
                state,
                captured,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: buildStructuredBookingReply(state, services, []),
            }
        }
    }

    const service = findServiceById(services, state.current_booking?.service_id)
    if (!service || !state.current_booking) {
        return { state, captured, stateChanged: false, shouldBypassAI: false, directReply: null }
    }

    let stateChanged = false
    const previousAwaiting = cloneAwaitingField(state.awaiting_field)

    const selectionResult = extractSelectionsFromText(service, normalized, state.current_booking)
    state.current_booking = selectionResult.booking
    if (selectionResult.captured.length > 0) {
        captured.push(...selectionResult.captured)
        stateChanged = true
    }

    const dates = extractDates(text)
    if (!state.current_booking.preferred_date && dates[0]) {
        state.current_booking.preferred_date = dates[0]
        captured.push({ type: 'preferred_date', value: dates[0] })
        stateChanged = true
    }

    if (serviceNeedsEndDate(service) && !state.current_booking.end_date) {
        const endDateCandidate = dates.length > 1 ? dates[1] : null
        if (endDateCandidate) {
            state.current_booking.end_date = endDateCandidate
            captured.push({ type: 'end_date', value: endDateCandidate })
            stateChanged = true
        }
    }

    if (serviceNeedsTime(service) && !state.current_booking.preferred_time) {
        const extractedTime = extractTime(text)
        if (extractedTime) {
            state.current_booking.preferred_time = extractedTime
            captured.push({ type: 'preferred_time', value: extractedTime })
            stateChanged = true
        }
    }

    if (serviceNeedsPartySize(service) && !state.current_booking.party_size) {
        const extractedPartySize = extractPartySize(text)
        if (extractedPartySize) {
            state.current_booking.party_size = extractedPartySize
            captured.push({ type: 'party_size', value: extractedPartySize })
            stateChanged = true
        }
    }

    if (!state.current_booking.customer_phone) {
        const extractedPhone = extractCustomerPhone(text)
        if (extractedPhone) {
            state.current_booking.customer_phone = extractedPhone
            captured.push({ type: 'customer_phone', value: extractedPhone })
            stateChanged = true
        }
    }

    if (serviceNeedsPaymentChoice(service) && !state.current_booking.payment_method) {
        const extractedPaymentMethod = detectBookingPaymentMethod(text)
        if (extractedPaymentMethod) {
            state.current_booking.payment_method = extractedPaymentMethod
            captured.push({ type: 'payment_method', value: extractedPaymentMethod })
            stateChanged = true
        }
    }

    if (!state.current_booking.customer_name && state.awaiting_field?.type === 'customer_name') {
        const extractedName = extractCustomerName(text)
        if (extractedName) {
            state.current_booking.customer_name = extractedName
            captured.push({ type: 'customer_name', value: extractedName })
            stateChanged = true
        }
    }

    if (state.awaiting_field?.type === 'notes' && !state.current_booking.note_declined && state.current_booking.notes === null) {
        state.current_booking.notes = String(text || '').trim()
        captured.push({ type: 'notes', value: state.current_booking.notes })
        stateChanged = true
    }

    state.awaiting_field = buildAwaitingField(service, state.current_booking)
    state.stage = state.awaiting_field ? BOOKING_STAGE.COLLECTING : BOOKING_STAGE.RECAP
    state.last_prompt_kind = state.stage
    state.last_prompt_text = normalized

    const awaitingChanged = JSON.stringify(previousAwaiting) !== JSON.stringify(state.awaiting_field)
    const shouldBypassAI = stateChanged || awaitingChanged

    return {
        state,
        captured,
        stateChanged: stateChanged || awaitingChanged,
        shouldBypassAI,
        directReply: shouldBypassAI ? buildStructuredBookingReply(state, services, captured) : null,
    }
}

function inferBookingStateFromAssistantMessage(content, previousState = {}, services = []) {
    const state = cloneBookingState(previousState)
    const text = normalizeText(content)

    if (!text) return state

    if (/reservation confirmee|reservation creee|booking confirmed/i.test(text)) {
        return cloneBookingState({})
    }

    if (/confirmez-vous/i.test(content)) {
        state.stage = BOOKING_STAGE.RECAP
        state.awaiting_field = null
        state.last_prompt_kind = BOOKING_STAGE.RECAP
        state.last_prompt_text = content
        return state
    }

    const service = findServiceById(services, state.current_booking?.service_id)
    if (!service || !state.current_booking) return state

    const awaitingField = buildAwaitingField(service, state.current_booking)
    if (awaitingField) {
        state.stage = BOOKING_STAGE.COLLECTING
        state.awaiting_field = awaitingField
        state.last_prompt_kind = BOOKING_STAGE.COLLECTING
        state.last_prompt_text = content
    }

    return state
}

function buildBookingStateGuidance(bookingState, services = []) {
    const state = cloneBookingState(bookingState)
    const service = findServiceById(services, state.current_booking?.service_id)

    if (!service || !state.current_booking) return ''

    const lines = ['BOOKING STATE (source systeme, prioritaire):']
    lines.push(`- Service courant: ${state.current_booking.service_name}`)

    const selectedVariants = Object.entries(state.current_booking.selected_variants || {})
    if (selectedVariants.length > 0) {
        lines.push(`- Variantes fixes deja collectees: ${selectedVariants.map(([label, value]) => `${label}=${value}`).join(', ')}`)
    }

    const selectedSupplements = Object.keys(state.current_booking.selected_supplements || {})
    if (selectedSupplements.length > 0) {
        lines.push(`- Supplements deja collectes: ${selectedSupplements.join(', ')}`)
    }

    if (state.current_booking.preferred_date) lines.push(`- Date deja collectee: ${state.current_booking.preferred_date}`)
    if (state.current_booking.end_date) lines.push(`- Date de fin deja collectee: ${state.current_booking.end_date}`)
    if (state.current_booking.preferred_time) lines.push(`- Heure deja collectee: ${state.current_booking.preferred_time}`)
    if (state.current_booking.party_size) lines.push(`- Taille de groupe deja collectee: ${state.current_booking.party_size}`)
    if (state.current_booking.customer_name) lines.push(`- Nom deja collecte: ${state.current_booking.customer_name}`)
    if (state.current_booking.customer_phone) lines.push(`- Telephone deja collecte: ${state.current_booking.customer_phone}`)
    if (state.current_booking.payment_method) lines.push(`- Paiement deja choisi: ${formatBookingPaymentLabel(state.current_booking.payment_method)}`)

    if (state.current_booking.note_declined) {
        lines.push('- Le client a refuse les demandes particulieres.')
    } else if (state.current_booking.notes) {
        lines.push(`- Notes deja collectees: ${state.current_booking.notes}`)
    }

    if (state.awaiting_field?.label) {
        lines.push(`- Champ bloquant actuel: ${state.awaiting_field.label}`)
    }

    lines.push('- Si le client donne une information utile hors ordre, memorise-la sans redemander les champs deja collectes.')
    lines.push('- Ne demande jamais une adresse de livraison pour une reservation de service.')

    return lines.join('\n')
}

function mergeBookingStateIntoToolArgs(functionName, args = {}, bookingState = {}) {
    if (functionName !== 'create_booking') return args

    const state = cloneBookingState(bookingState)
    const booking = state.current_booking
    if (!booking || !booking.service_name) return args

    return {
        ...args,
        service_name: args.service_name || booking.service_name,
        selected_variant: args.selected_variant || Object.values(booking.selected_variants || {})[0],
        selected_variants: {
            ...(booking.selected_variants || {}),
            ...(args.selected_variants || {}),
        },
        selected_supplements: Object.keys(booking.selected_supplements || {}).reduce((acc, key) => {
            acc[key] = true
            return acc
        }, { ...(args.selected_supplements || {}) }),
        preferred_date: args.preferred_date || booking.preferred_date || args.preferred_date,
        preferred_time: args.preferred_time || booking.preferred_time || args.preferred_time,
        end_date: args.end_date || booking.end_date || args.end_date,
        party_size: args.party_size || booking.party_size || args.party_size,
        customer_name: args.customer_name || booking.customer_name || args.customer_name,
        customer_phone: args.customer_phone || booking.customer_phone || args.customer_phone,
        payment_method: args.payment_method || booking.payment_method || args.payment_method,
        notes: args.notes !== undefined ? args.notes : booking.notes,
    }
}

module.exports = {
    BOOKING_STAGE,
    buildBookingStateGuidance,
    clearBookingState,
    getBookingState,
    inferBookingStateFromAssistantMessage,
    mergeBookingStateIntoToolArgs,
    setBookingState,
    updateBookingStateFromUserMessage,
}
