export type PhoneCountryCode = {
    dial: string
    flag: string
    name: string
}

export const PHONE_COUNTRY_CODES: PhoneCountryCode[] = [
    { dial: '+225', flag: '🇨🇮', name: "Cote d'Ivoire" },
    { dial: '+221', flag: '🇸🇳', name: 'Senegal' },
    { dial: '+223', flag: '🇲🇱', name: 'Mali' },
    { dial: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
    { dial: '+227', flag: '🇳🇪', name: 'Niger' },
    { dial: '+224', flag: '🇬🇳', name: 'Guinee' },
    { dial: '+228', flag: '🇹🇬', name: 'Togo' },
    { dial: '+229', flag: '🇧🇯', name: 'Benin' },
    { dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
    { dial: '+242', flag: '🇨🇬', name: 'Congo' },
    { dial: '+243', flag: '🇨🇩', name: 'RD Congo' },
    { dial: '+241', flag: '🇬🇦', name: 'Gabon' },
    { dial: '+240', flag: '🇬🇶', name: 'Guinee eq.' },
    { dial: '+236', flag: '🇨🇫', name: 'Centrafrique' },
    { dial: '+235', flag: '🇹🇩', name: 'Tchad' },
    { dial: '+212', flag: '🇲🇦', name: 'Maroc' },
    { dial: '+213', flag: '🇩🇿', name: 'Algerie' },
    { dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
    { dial: '+234', flag: '🇳🇬', name: 'Nigeria' },
    { dial: '+233', flag: '🇬🇭', name: 'Ghana' },
    { dial: '+33', flag: '🇫🇷', name: 'France' },
    { dial: '+32', flag: '🇧🇪', name: 'Belgique' },
    { dial: '+41', flag: '🇨🇭', name: 'Suisse' },
    { dial: '+352', flag: '🇱🇺', name: 'Luxembourg' },
    { dial: '+1', flag: '🇺🇸', name: 'Etats-Unis / Canada' },
    { dial: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
]

function digitsOnly(value: string) {
    return value.replace(/\D/g, '')
}

export function sanitizeLocalPhoneDigits(value: string) {
    return digitsOnly(value).replace(/^0+/, '')
}

export function buildInternationalPhone(countryDial: string, localPhone: string) {
    const dial = countryDial.trim()
    const digits = sanitizeLocalPhoneDigits(localPhone)

    if (!dial || !digits) return null

    const normalizedDial = dial.startsWith('+') ? dial : `+${digitsOnly(dial)}`
    const phone = `${normalizedDial}${digits}`

    return isValidInternationalPhone(phone) ? phone : null
}

export function normalizeStoredPhone(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return null

    let normalized = trimmed
        .replace(/[.\-\s()]/g, '')
        .replace(/^00/, '+')

    if (!normalized.startsWith('+')) {
        return null
    }

    normalized = `+${digitsOnly(normalized)}`

    return isValidInternationalPhone(normalized) ? normalized : null
}

export function isValidInternationalPhone(value: string) {
    return /^\+[1-9]\d{7,14}$/.test(value)
}

export function hasProfilePhone(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
}
