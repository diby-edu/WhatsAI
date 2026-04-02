const DAY_MS = 24 * 60 * 60 * 1000

function normalizeBookingType(value, serviceSubtype = 'other') {
    const normalized = String(value || '').trim().toLowerCase()

    switch (normalized) {
        case 'stay':
        case 'table':
        case 'slot':
        case 'rental':
        case 'inscription':
            return normalized
        case 'hotel':
        case 'residence':
            return 'stay'
        case 'restaurant':
        case 'event':
            return 'table'
        case 'service':
        case 'coiffeur':
        case 'medecin':
        case 'coaching':
        case 'prestation':
        case 'other':
            return 'slot'
        case 'formation':
            return 'inscription'
        default:
            break
    }

    const fallback = String(serviceSubtype || '').trim().toLowerCase()

    switch (fallback) {
        case 'stay':
        case 'hotel':
        case 'residence':
            return 'stay'
        case 'table':
        case 'restaurant':
        case 'event':
            return 'table'
        case 'rental':
            return 'rental'
        case 'inscription':
        case 'formation':
            return 'inscription'
        default:
            return 'slot'
    }
}

function bookingTypeNeedsTime(bookingType) {
    return ['slot', 'table'].includes(normalizeBookingType(bookingType))
}

function bookingTypeNeedsEndDate(bookingType) {
    return ['stay', 'rental'].includes(normalizeBookingType(bookingType))
}

function bookingTypeNeedsPartySize(bookingType) {
    return ['stay', 'table'].includes(normalizeBookingType(bookingType))
}

function bookingTypeNeedsPaymentChoice(bookingType) {
    return ['stay', 'rental'].includes(normalizeBookingType(bookingType))
}

function normalizeBookingPaymentMethod(value) {
    const normalized = String(value || '').trim().toLowerCase()

    if (!normalized) return null

    if (
        normalized === 'online' ||
        normalized.includes('en ligne') ||
        normalized.includes('online') ||
        normalized.includes('lien de paiement') ||
        normalized.includes('paiement automatique') ||
        normalized.includes('mobile money') ||
        normalized.includes('cinetpay') ||
        normalized.includes('carte') ||
        normalized.includes('payer maintenant')
    ) {
        return 'online'
    }

    if (
        normalized === 'onsite' ||
        normalized.includes('sur place') ||
        normalized.includes('sur-site') ||
        normalized.includes('sur site') ||
        normalized.includes("a l'arrivee") ||
        normalized.includes("a l arrivee") ||
        normalized.includes('au retrait') ||
        normalized.includes('paiement sur place')
    ) {
        return 'onsite'
    }

    return null
}

function formatBookingPaymentLabel(paymentMethod) {
    if (paymentMethod === 'online') return 'lien de paiement automatique'
    if (paymentMethod === 'onsite') return 'paiement manuel sur place'
    return 'non precise'
}

function parseIsoDateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null
    }

    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))

    if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null
    }

    return parsed
}

function calculateDateRangeDays(startDate, endDate) {
    const start = parseIsoDateOnly(startDate)
    const end = parseIsoDateOnly(endDate)

    if (!start || !end) {
        return { days: null, error: 'DATES INVALIDES. Utilisez le format YYYY-MM-DD.' }
    }

    const diffDays = Math.round((end.getTime() - start.getTime()) / DAY_MS)
    if (diffDays <= 0) {
        return {
            days: null,
            error: 'DATES INVALIDES. La date de fin doit etre posterieure a la date de debut.'
        }
    }

    return { days: diffDays, error: null }
}

module.exports = {
    bookingTypeNeedsEndDate,
    bookingTypeNeedsPartySize,
    bookingTypeNeedsPaymentChoice,
    bookingTypeNeedsTime,
    calculateDateRangeDays,
    formatBookingPaymentLabel,
    normalizeBookingPaymentMethod,
    normalizeBookingType,
    parseIsoDateOnly,
}
