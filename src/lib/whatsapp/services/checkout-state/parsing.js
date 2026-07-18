const {
    normalizePhoneNumber,
} = require('../../ai/tools/tool-helpers')

function normalizeFreeText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizeComparisonText(text) {
    return normalizeFreeText(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
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

function looksLikeKnowledgeQuestion(text) {
    const normalized = normalizeFreeText(text).toLowerCase()
    if (!normalized || normalized.length < 4) return false
    if (/^\d+$/.test(normalized)) return false
    if (isPositiveReply(normalized) || isNegativeReply(normalized)) return false
    if (extractPhoneFromText(normalized) && normalized.split(' ').length <= 3) return false
    if (extractEmailFromText(normalized) && normalized.split(' ').length <= 3) return false

    return [
        '?',
        "c'est quoi",
        'cest quoi',
        "qu'est-ce que",
        'quest ce que',
        'qu est ce que',
        'comment',
        'pourquoi',
        'quel ',
        'quelle ',
        'quels ',
        'quelles ',
        'est ce que',
        'ca veut dire',
        'explique',
        'detail',
        'difference',
        'compatible',
        'contenu',
        'format',
        'duree',
        'garantie',
    ].some(pattern => normalized.includes(pattern))
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

function looksLikeLocalPhoneWithoutCountryCode(text) {
    const compact = String(text || '')
        .trim()
        .replace(/[\s\-\(\)\.]/g, '')

    if (!compact) return false
    if (compact.startsWith('00') || compact.startsWith('+')) return false

    return /^0\d{7,14}$/.test(compact)
}

function normalizeEmailText(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function extractEmailFromText(text) {
    const match = normalizeEmailText(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    return match ? match[0].toLowerCase() : null
}

function buildAwaitingFieldValidationReply(awaitingField, text) {
    const fieldType = awaitingField?.type
    if (!fieldType) return null

    if (fieldType === 'customer_phone') {
        if (looksLikeLocalPhoneWithoutCountryCode(text)) {
            return "Votre numero doit inclure l'indicatif pays. Exemple : +2250554585927."
        }

        const digits = String(text || '').replace(/[^\d+]/g, '')
        if (digits.length >= 8) {
            return "Le format du numero semble invalide. Envoyez un numero complet avec indicatif pays. Exemple : +2250700000000."
        }
    }

    if (fieldType === 'email') {
        if (String(text || '').includes('@')) {
            return "L'adresse email semble invalide. Utilisez un format comme koffi@gmail.com."
        }

        return "Envoyez une adresse email complete, par exemple : koffi@gmail.com."
    }

    return null
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

function extractMapsLink(text) {
    const match = String(text || '').match(
        /https?:\/\/(maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl|www\.google\.com\/maps)[^\s]*/i
    )
    return match ? match[0] : null
}

function extractDeliveryAddress(text) {
    // Accepte un lien Google Maps comme adresse
    const mapsLink = extractMapsLink(text)
    if (mapsLink) return mapsLink

    const normalized = normalizeFreeText(text)
    if (!normalized) return null

    const tokens = tokenizeWords(normalized)
    if (tokens.length < 2) return null

    return normalized
}

function wantsPreviousCustomerValue(text, fieldType = '') {
    const normalized = normalizeComparisonText(text)
    if (!normalized) return false

    const hasReuseCue = /\b(meme|pareil|idem|same)\b/.test(normalized)
    if (!hasReuseCue) return false

    const genericShortReply = tokenizeWords(normalized).length <= 3
    if (genericShortReply) return true

    const fieldHints = {
        customer_name: ['nom'],
        customer_phone: ['numero', 'telephone', 'tel', 'indicatif'],
        email: ['email', 'mail', 'adresse'],
        delivery_address: ['adresse', 'livraison', 'localisation', 'quartier', 'ville'],
    }

    const hints = fieldHints[fieldType] || []
    return hints.some(hint => normalized.includes(hint))
}

function reusePreviousCustomerValue(state, field, recentCustomerProfile, capturedFields) {
    const fieldMap = {
        customer_name: 'customer_name',
        customer_phone: 'customer_phone',
        email: 'email',
        delivery_address: 'delivery_address',
    }

    const profileKey = fieldMap[field]
    const previousValue = profileKey ? recentCustomerProfile?.[profileKey] : null
    if (!previousValue || state.collected[field]) return false

    state.collected[field] = previousValue
    removePendingField(state, field)
    capturedFields.push({ type: field, value: previousValue })
    return true
}

function removePendingField(state, field) {
    state.pending_fields = state.pending_fields.filter(item => item !== field)
}


module.exports = {
    normalizeFreeText,
    normalizeComparisonText,
    tokenizeWords,
    isPositiveReply,
    isNegativeReply,
    looksLikeKnowledgeQuestion,
    detectPaymentMethod,
    extractPhoneFromText,
    looksLikeLocalPhoneWithoutCountryCode,
    normalizeEmailText,
    extractEmailFromText,
    buildAwaitingFieldValidationReply,
    extractCustomerName,
    extractMapsLink,
    extractDeliveryAddress,
    wantsPreviousCustomerValue,
    reusePreviousCustomerValue,
    removePendingField,
}
