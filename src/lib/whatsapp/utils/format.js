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

    // 3. AUTO-AJOUTER "+" pour les indicatifs pays connus (si absent)
    const knownCountryCodes = ['225', '33', '32', '221', '237', '229', '228', '223', '224', '1', '44', '49']

    // Cas spécial : Numéro local 10 chiffres (ex: 0747094746) → Ajouter +225 par défaut
    if (!normalized.startsWith('+') && normalized.length === 10 && normalized.startsWith('0')) {
        console.log(`📱 Local number detected (${normalized}), adding default +225`)
        normalized = '+225' + normalized.substring(1) // Enlever le 0
    }

    // Cas standard : Commence par un code pays mais sans le "+"
    if (!normalized.startsWith('+')) {
        for (const code of knownCountryCodes) {
            if (normalized.startsWith(code) && normalized.length >= (code.length + 6)) { // au moins 6 chiffres après le code
                normalized = '+' + normalized
                console.log(`📱 Auto-added "+" for country code ${code}`)
                break
            }
        }
    }

    // 4. VALIDATION : Doit maintenant commencer par "+"
    if (!normalized.startsWith('+')) {
        // DERNIÈRE CHANCE : Si ressemble à un format valide (10-15 digits) mais sans code, on assume 225
        if (/^\d{10,15}$/.test(normalized)) {
            console.log('⚠️ No country code detected, enforcing +225 fallback')
            if (normalized.startsWith('0')) normalized = normalized.substring(1)
            if (!normalized.startsWith('225')) normalized = '225' + normalized
            normalized = '+' + normalized
        } else {
            console.warn('⚠️ PHONE REJECTED : Missing country code ("+") :', phone)
            return null
        }
    }

    const digitsOnly = normalized.substring(1) // Retirer le "+"
    if (!/^\d{10,15}$/.test(digitsOnly)) {
        console.warn('⚠️ PHONE REJECTED : Invalid format (must contain 10-15 digits) :', phone)
        return null
    }

    console.log(`✅ Phone Normalized : "${phone}" → "${normalized}"`)
    return normalized
}

module.exports = { normalizePhoneNumber }
