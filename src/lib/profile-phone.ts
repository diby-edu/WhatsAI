export type PhoneCountryCode = {
    dial: string
    flag: string
    name: string
}

export const PHONE_COUNTRY_CODES: PhoneCountryCode[] = [
    // Afrique de l'Ouest
    { dial: '+225', flag: '🇨🇮', name: "Cote d'Ivoire" },
    { dial: '+221', flag: '🇸🇳', name: 'Senegal' },
    { dial: '+223', flag: '🇲🇱', name: 'Mali' },
    { dial: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
    { dial: '+227', flag: '🇳🇪', name: 'Niger' },
    { dial: '+224', flag: '🇬🇳', name: 'Guinee' },
    { dial: '+245', flag: '🇬🇼', name: 'Guinee-Bissau' },
    { dial: '+228', flag: '🇹🇬', name: 'Togo' },
    { dial: '+229', flag: '🇧🇯', name: 'Benin' },
    { dial: '+234', flag: '🇳🇬', name: 'Nigeria' },
    { dial: '+233', flag: '🇬🇭', name: 'Ghana' },
    { dial: '+232', flag: '🇸🇱', name: 'Sierra Leone' },
    { dial: '+231', flag: '🇱🇷', name: 'Liberia' },
    { dial: '+220', flag: '🇬🇲', name: 'Gambie' },
    { dial: '+238', flag: '🇨🇻', name: 'Cap-Vert' },
    { dial: '+222', flag: '🇲🇷', name: 'Mauritanie' },
    // Afrique Centrale
    { dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
    { dial: '+242', flag: '🇨🇬', name: 'Congo' },
    { dial: '+243', flag: '🇨🇩', name: 'RD Congo' },
    { dial: '+241', flag: '🇬🇦', name: 'Gabon' },
    { dial: '+240', flag: '🇬🇶', name: 'Guinee eq.' },
    { dial: '+236', flag: '🇨🇫', name: 'Centrafrique' },
    { dial: '+235', flag: '🇹🇩', name: 'Tchad' },
    { dial: '+239', flag: '🇸🇹', name: 'Sao Tome' },
    { dial: '+244', flag: '🇦🇴', name: 'Angola' },
    // Afrique du Nord
    { dial: '+212', flag: '🇲🇦', name: 'Maroc' },
    { dial: '+213', flag: '🇩🇿', name: 'Algerie' },
    { dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
    { dial: '+218', flag: '🇱🇾', name: 'Libye' },
    { dial: '+20', flag: '🇪🇬', name: 'Egypte' },
    { dial: '+249', flag: '🇸🇩', name: 'Soudan' },
    { dial: '+211', flag: '🇸🇸', name: 'Soudan du Sud' },
    // Afrique de l'Est
    { dial: '+251', flag: '🇪🇹', name: 'Ethiopie' },
    { dial: '+253', flag: '🇩🇯', name: 'Djibouti' },
    { dial: '+291', flag: '🇪🇷', name: 'Erythree' },
    { dial: '+252', flag: '🇸🇴', name: 'Somalie' },
    { dial: '+254', flag: '🇰🇪', name: 'Kenya' },
    { dial: '+255', flag: '🇹🇿', name: 'Tanzanie' },
    { dial: '+256', flag: '🇺🇬', name: 'Ouganda' },
    { dial: '+250', flag: '🇷🇼', name: 'Rwanda' },
    { dial: '+257', flag: '🇧🇮', name: 'Burundi' },
    { dial: '+258', flag: '🇲🇿', name: 'Mozambique' },
    { dial: '+260', flag: '🇿🇲', name: 'Zambie' },
    { dial: '+265', flag: '🇲🇼', name: 'Malawi' },
    // Afrique Australe & Océan Indien
    { dial: '+27', flag: '🇿🇦', name: 'Afrique du Sud' },
    { dial: '+263', flag: '🇿🇼', name: 'Zimbabwe' },
    { dial: '+264', flag: '🇳🇦', name: 'Namibie' },
    { dial: '+267', flag: '🇧🇼', name: 'Botswana' },
    { dial: '+268', flag: '🇸🇿', name: 'Eswatini' },
    { dial: '+266', flag: '🇱🇸', name: 'Lesotho' },
    { dial: '+261', flag: '🇲🇬', name: 'Madagascar' },
    { dial: '+230', flag: '🇲🇺', name: 'Maurice' },
    { dial: '+262', flag: '🇷🇪', name: 'Reunion' },
    { dial: '+269', flag: '🇰🇲', name: 'Comores' },
    { dial: '+248', flag: '🇸🇨', name: 'Seychelles' },
    // Europe
    { dial: '+33', flag: '🇫🇷', name: 'France' },
    { dial: '+32', flag: '🇧🇪', name: 'Belgique' },
    { dial: '+41', flag: '🇨🇭', name: 'Suisse' },
    { dial: '+352', flag: '🇱🇺', name: 'Luxembourg' },
    { dial: '+34', flag: '🇪🇸', name: 'Espagne' },
    { dial: '+351', flag: '🇵🇹', name: 'Portugal' },
    { dial: '+39', flag: '🇮🇹', name: 'Italie' },
    { dial: '+49', flag: '🇩🇪', name: 'Allemagne' },
    { dial: '+31', flag: '🇳🇱', name: 'Pays-Bas' },
    { dial: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
    // Amériques
    { dial: '+1', flag: '🇺🇸', name: 'Etats-Unis' },
    { dial: '+1', flag: '🇨🇦', name: 'Canada' },
    { dial: '+509', flag: '🇭🇹', name: 'Haiti' },
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
