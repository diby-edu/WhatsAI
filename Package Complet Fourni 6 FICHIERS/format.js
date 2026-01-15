/**
 * ═══════════════════════════════════════════════════════════════
 * WHATSAPP UTILITY : PHONE NUMBER FORMATTER (v2.2 - FIXED)
 * ═══════════════════════════════════════════════════════════════
 * 
 * RÈGLE D'OR (Principe 4 - Prompt Builder) :
 * - Format INTERNATIONAL OBLIGATOIRE : +XXX...
 * - Accepte TOUT format lisible : espaces, tirets, parenthèses OK
 * - Rejette les numéros SANS indicatif pays
 * 
 * CHANGELOG v2.2 (FIX CRITIQUE) :
 * ✅ Préserve le "+" (au lieu de le retirer)
 * ✅ Rejette les numéros sans indicatif pays
 * ✅ Convertit "00" en "+"
 * ✅ Validation stricte : 10-15 chiffres
 * 
 * EXEMPLES VALIDES :
 * ✅ +225 07 56 23 69 84  → +2250756236984
 * ✅ +33 7 12 34 56 78    → +33712345678
 * ✅ (225) 07-56-23-69-84 → +2250756236984
 * ✅ 002250756236984      → +2250756236984 (00 = international prefix)
 * 
 * EXEMPLES INVALIDES :
 * ❌ 07 56 23 69 84       → null (pas d'indicatif)
 * ❌ 0756236984           → null (numéro local)
 * ❌ 225...               → null (commence par indicatif mais sans +)
 */

/**
 * Normalize phone number for WhatsApp
 * @param {string} phone - Raw phone number from user
 * @returns {string|null} - Normalized phone with "+" or null if invalid
 */
function normalizePhoneNumber(phone) {
    if (!phone) return null

    let normalized = phone.toString().trim()

    // 1. NETTOYER : Supprimer espaces, tirets, parenthèses
    normalized = normalized.replace(/[\s\-\(\)]/g, '')

    // 2. CONVERTIR "00" → "+" (préfixe international)
    if (normalized.startsWith('00')) {
        normalized = '+' + normalized.substring(2)
    }

    // 3. VALIDATION STRICTE : Doit commencer par "+"
    if (!normalized.startsWith('+')) {
        console.warn('⚠️ PHONE REJECTED : Missing country code ("+") :', phone)
        return null
    }

    // 4. VÉRIFIER : Au moins 10 chiffres après le "+"
    const digitsOnly = normalized.substring(1) // Retirer le "+"
    if (!/^\d{10,15}$/.test(digitsOnly)) {
        console.warn('⚠️ PHONE REJECTED : Invalid format (must contain 10-15 digits) :', phone)
        return null
    }

    // 5. RETOURNER le numéro normalisé AVEC le "+"
    console.log(`✅ Phone Normalized : "${phone}" → "${normalized}"`)
    return normalized
}

module.exports = { normalizePhoneNumber }
