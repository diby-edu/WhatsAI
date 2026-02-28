/**
 * ═══════════════════════════════════════════════════════════════
 * CURRENCY CONVERSION UTILITY
 * ═══════════════════════════════════════════════════════════════
 * 
 * Les prix en DB sont TOUJOURS en FCFA (champ price_fcfa).
 * Ce module convertit pour l'affichage dans la devise de l'utilisateur.
 * 
 * Taux approximatifs : 1 USD ≈ 700 FCFA, 1 EUR ≈ 700 FCFA
 */

const FCFA_RATES: Record<string, number> = {
    USD: 700,
    EUR: 700,
    XOF: 1,   // FCFA = XOF, pas de conversion
    FCFA: 1,  // Alias
}

/**
 * Convertit un prix stocké en FCFA vers la devise d'affichage.
 * @param priceFcfa - Prix en FCFA (depuis la DB)
 * @param currency  - Devise cible de l'utilisateur (USD, EUR, XOF)
 * @returns Prix converti (arrondi à 2 décimales pour USD/EUR)
 */
export function convertFromFcfa(priceFcfa: number, currency: string): number {
    if (!priceFcfa || priceFcfa === 0) return 0
    const rate = FCFA_RATES[currency] || 1
    if (rate === 1) return priceFcfa
    return Math.round((priceFcfa / rate) * 100) / 100
}

/**
 * Convertit un prix dans une devise vers FCFA (pour l'enregistrement en DB).
 * @param price    - Prix dans la devise de l'utilisateur
 * @param currency - Devise source de l'utilisateur (USD, EUR, XOF)
 * @returns Prix en FCFA (arrondi à l'entier)
 */
export function convertToFcfa(price: number, currency: string): number {
    if (!price || price === 0) return 0
    const rate = FCFA_RATES[currency] || 1
    if (rate === 1) return price
    return Math.round(price * rate)
}

/**
 * Formate un prix FCFA dans la devise de l'utilisateur avec le bon symbole.
 * @param priceFcfa - Prix en FCFA (depuis la DB)
 * @param currency  - Devise d'affichage de l'utilisateur
 * @param locale    - Locale pour le formatage (default: 'fr-FR')
 */
export function formatPriceFromFcfa(
    priceFcfa: number,
    currency: string,
    locale: string = 'fr-FR'
): string {
    const converted = convertFromFcfa(priceFcfa, currency)

    // XOF n'est pas reconnu par tous les navigateurs, fallback sur format manuel
    if (currency === 'XOF' || currency === 'FCFA') {
        return new Intl.NumberFormat(locale, {
            maximumFractionDigits: 0
        }).format(converted) + ' FCFA'
    }

    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 2
    }).format(converted)
}
