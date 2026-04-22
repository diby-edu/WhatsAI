export type FeexPayCountryCode = 'BJ' | 'TG' | 'CI' | 'CG' | 'SN'

export type FeexPayNetworkCode =
    | 'mtn'
    | 'moov'
    | 'celtiis_bj'
    | 'coris'
    | 'togocom_tg'
    | 'moov_tg'
    | 'mtn_ci'
    | 'moov_ci'
    | 'wave_ci'
    | 'orange_ci'
    | 'mtn_cg'
    | 'orange_sn'
    | 'wave_sn'
    | 'free_sn'

export type FeexPaySelectionError = 'NETWORK_COUNTRY_MISMATCH'

export interface FeexPayNetworkOption {
    code: FeexPayNetworkCode
    label: string
    countryCode: FeexPayCountryCode
    countryName: string
    dialCode: string
    requiresOtp: boolean
    supportsHostedRedirect: boolean
}

export interface FeexPayCountryOption {
    code: FeexPayCountryCode
    name: string
    dialCode: string
    networks: FeexPayNetworkOption[]
}

const COUNTRY_LABELS: Record<FeexPayCountryCode, { name: string; dialCode: string }> = {
    BJ: { name: 'Benin', dialCode: '229' },
    TG: { name: 'Togo', dialCode: '228' },
    CI: { name: "Cote d'Ivoire", dialCode: '225' },
    CG: { name: 'Congo Brazzaville', dialCode: '242' },
    SN: { name: 'Senegal', dialCode: '221' },
}

const NETWORK_OPTIONS: FeexPayNetworkOption[] = [
    // Benin
    { code: 'mtn', label: 'MTN Benin', countryCode: 'BJ', countryName: COUNTRY_LABELS.BJ.name, dialCode: COUNTRY_LABELS.BJ.dialCode, requiresOtp: false, supportsHostedRedirect: false },
    { code: 'moov', label: 'Moov Benin', countryCode: 'BJ', countryName: COUNTRY_LABELS.BJ.name, dialCode: COUNTRY_LABELS.BJ.dialCode, requiresOtp: false, supportsHostedRedirect: false },
    { code: 'celtiis_bj', label: 'Celtiis Benin', countryCode: 'BJ', countryName: COUNTRY_LABELS.BJ.name, dialCode: COUNTRY_LABELS.BJ.dialCode, requiresOtp: false, supportsHostedRedirect: false },
    { code: 'coris', label: 'Coris Benin', countryCode: 'BJ', countryName: COUNTRY_LABELS.BJ.name, dialCode: COUNTRY_LABELS.BJ.dialCode, requiresOtp: true, supportsHostedRedirect: false },

    // Togo
    { code: 'togocom_tg', label: 'Togocom', countryCode: 'TG', countryName: COUNTRY_LABELS.TG.name, dialCode: COUNTRY_LABELS.TG.dialCode, requiresOtp: false, supportsHostedRedirect: false },
    { code: 'moov_tg', label: 'Moov Togo', countryCode: 'TG', countryName: COUNTRY_LABELS.TG.name, dialCode: COUNTRY_LABELS.TG.dialCode, requiresOtp: false, supportsHostedRedirect: false },

    // Cote d'Ivoire
    { code: 'mtn_ci', label: "MTN Cote d'Ivoire", countryCode: 'CI', countryName: COUNTRY_LABELS.CI.name, dialCode: COUNTRY_LABELS.CI.dialCode, requiresOtp: false, supportsHostedRedirect: false },
    { code: 'moov_ci', label: "Moov Cote d'Ivoire", countryCode: 'CI', countryName: COUNTRY_LABELS.CI.name, dialCode: COUNTRY_LABELS.CI.dialCode, requiresOtp: false, supportsHostedRedirect: true },
    { code: 'wave_ci', label: "Wave Cote d'Ivoire", countryCode: 'CI', countryName: COUNTRY_LABELS.CI.name, dialCode: COUNTRY_LABELS.CI.dialCode, requiresOtp: false, supportsHostedRedirect: true },
    { code: 'orange_ci', label: "Orange Cote d'Ivoire", countryCode: 'CI', countryName: COUNTRY_LABELS.CI.name, dialCode: COUNTRY_LABELS.CI.dialCode, requiresOtp: false, supportsHostedRedirect: true },

    // Congo
    { code: 'mtn_cg', label: 'MTN Congo Brazzaville', countryCode: 'CG', countryName: COUNTRY_LABELS.CG.name, dialCode: COUNTRY_LABELS.CG.dialCode, requiresOtp: false, supportsHostedRedirect: false },

    // Senegal
    { code: 'orange_sn', label: 'Orange Senegal', countryCode: 'SN', countryName: COUNTRY_LABELS.SN.name, dialCode: COUNTRY_LABELS.SN.dialCode, requiresOtp: true, supportsHostedRedirect: false },
    { code: 'wave_sn', label: 'Wave Senegal', countryCode: 'SN', countryName: COUNTRY_LABELS.SN.name, dialCode: COUNTRY_LABELS.SN.dialCode, requiresOtp: false, supportsHostedRedirect: true },
    { code: 'free_sn', label: 'Free Senegal', countryCode: 'SN', countryName: COUNTRY_LABELS.SN.name, dialCode: COUNTRY_LABELS.SN.dialCode, requiresOtp: false, supportsHostedRedirect: true },
]

const NETWORK_MAP = new Map<FeexPayNetworkCode, FeexPayNetworkOption>(
    NETWORK_OPTIONS.map((option) => [option.code, option] as const)
)

const COUNTRY_CODES = new Set<FeexPayCountryCode>(Object.keys(COUNTRY_LABELS) as FeexPayCountryCode[])

function normalizeDigits(value?: string | null) {
    return String(value || '').replace(/\D+/g, '').trim()
}

export function normalizeFeexPayNetwork(value: unknown): FeexPayNetworkCode | null {
    const normalized = String(value || '').trim().toLowerCase() as FeexPayNetworkCode
    if (!normalized) return null
    return NETWORK_MAP.has(normalized) ? normalized : null
}

export function normalizeFeexPayCountry(value: unknown): FeexPayCountryCode | null {
    const normalized = String(value || '').trim().toUpperCase() as FeexPayCountryCode
    if (!normalized) return null
    return COUNTRY_CODES.has(normalized) ? normalized : null
}

export function getFeexPayNetworkOption(code: unknown): FeexPayNetworkOption | null {
    const normalized = normalizeFeexPayNetwork(code)
    if (!normalized) return null
    return NETWORK_MAP.get(normalized) || null
}

export function listFeexPayNetworks(): FeexPayNetworkOption[] {
    return NETWORK_OPTIONS.map((option) => ({ ...option }))
}

export function listFeexPayNetworksByCountry(country: unknown): FeexPayNetworkOption[] {
    const normalizedCountry = normalizeFeexPayCountry(country)
    if (!normalizedCountry) return []
    return NETWORK_OPTIONS
        .filter((option) => option.countryCode === normalizedCountry)
        .map((option) => ({ ...option }))
}

export function listFeexPayCountries(): FeexPayCountryOption[] {
    return (Object.keys(COUNTRY_LABELS) as FeexPayCountryCode[]).map((code) => ({
        code,
        name: COUNTRY_LABELS[code].name,
        dialCode: COUNTRY_LABELS[code].dialCode,
        networks: listFeexPayNetworksByCountry(code),
    }))
}

export function inferFeexPayCountryFromPhone(phone?: string | null): FeexPayCountryCode | null {
    const digits = normalizeDigits(phone)
    if (!digits) return null

    const countries = Object.entries(COUNTRY_LABELS) as Array<[FeexPayCountryCode, { dialCode: string; name: string }]>
    for (const [countryCode, config] of countries) {
        if (digits.startsWith(config.dialCode)) {
            return countryCode
        }
    }

    return null
}

export function isFeexPayOtpNetwork(network: unknown): boolean {
    const option = getFeexPayNetworkOption(network)
    return Boolean(option?.requiresOtp)
}

export function isFeexPayHostedRedirectNetwork(network: unknown): boolean {
    const option = getFeexPayNetworkOption(network)
    return Boolean(option?.supportsHostedRedirect)
}

export function resolveFeexPaySelection(input: {
    country?: unknown
    network?: unknown
    phone?: string | null
    defaultNetwork?: unknown
}): {
    countryCode: FeexPayCountryCode | null
    networkCode: FeexPayNetworkCode | null
    error: FeexPaySelectionError | null
} {
    const requestedCountry = normalizeFeexPayCountry(input.country)
    const requestedNetwork = normalizeFeexPayNetwork(input.network)

    if (requestedNetwork) {
        const option = getFeexPayNetworkOption(requestedNetwork)
        if (!option) {
            return { countryCode: null, networkCode: null, error: null }
        }

        if (requestedCountry && option.countryCode !== requestedCountry) {
            return { countryCode: null, networkCode: null, error: 'NETWORK_COUNTRY_MISMATCH' }
        }

        return { countryCode: option.countryCode, networkCode: option.code, error: null }
    }

    const inferredCountry = inferFeexPayCountryFromPhone(input.phone)
    const targetCountry = requestedCountry || inferredCountry
    const defaultNetwork = normalizeFeexPayNetwork(input.defaultNetwork)
    const defaultOption = getFeexPayNetworkOption(defaultNetwork)

    if (targetCountry) {
        if (defaultOption && defaultOption.countryCode === targetCountry) {
            return { countryCode: targetCountry, networkCode: defaultOption.code, error: null }
        }

        const countryNetworks = listFeexPayNetworksByCountry(targetCountry)
        if (countryNetworks.length > 0) {
            return { countryCode: targetCountry, networkCode: countryNetworks[0].code, error: null }
        }
    }

    if (defaultOption) {
        return { countryCode: defaultOption.countryCode, networkCode: defaultOption.code, error: null }
    }

    return { countryCode: null, networkCode: null, error: null }
}
