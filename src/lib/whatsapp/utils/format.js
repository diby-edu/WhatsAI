/**
 * ═══════════════════════════════════════════════════════════════
 * WHATSAPP UTILITY : PHONE NUMBER FORMATTER (v2.2 - FIXED)
 * ═══════════════════════════════════════════════════════════════
 * 
 * RÈGLE D'OR (Principe 4 - Prompt Builder) :
 * - Format INTERNATIONAL OBLIGATOIRE : indicatif pays explicite
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
 * ✅ 2250756236984        → +2250756236984
 * ✅ 002250756236984      → +2250756236984 (00 = international prefix)
 * 
 * EXEMPLES INVALIDES :
 * ❌ 07 56 23 69 84       → null (pas d'indicatif)
 * ❌ 0756236984           → null (numéro local)
 * ❌ 771234567            → null (ambigu, pas d'indicatif explicite)
 */

/**
 * Normalize phone number for WhatsApp
 * @param {string} phone - Raw phone number from user
 * @returns {string|null} - Normalized phone or null if invalid/ambiguous
 */
function normalizePhoneNumber(phone) {
    if (!phone) return null

    let normalized = phone.toString().trim()

    // 1. NETTOYER : Supprimer espaces, tirets, parenthèses, points
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '')

    if (!normalized) return null

    // 2. CONVERTIR "00" en "+" (préfixe international)
    if (normalized.startsWith('00')) {
        normalized = '+' + normalized.substring(2)
    }

    // 3. Si déjà avec "+", valider strictement
    if (normalized.startsWith('+')) {
        return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null
    }

    // 4. Sans "+", refuser tout ce qui n'est pas purement numérique
    if (!/^\d+$/.test(normalized)) return null

    // 5. Numéro local ambigu (commence par 0) -> rejet
    if (normalized.startsWith('0')) return null

    // 6. Sans "+", n'accepter que les numéros déjà internationaux
    return /^[1-9]\d{10,14}$/.test(normalized) ? `+${normalized}` : null
}

module.exports = { normalizePhoneNumber }
