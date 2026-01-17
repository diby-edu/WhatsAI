/**
 * ═══════════════════════════════════════════════════════════════
 * WHATSAPP UTILITY : PHONE NUMBER FORMATTER (v2.3 - HOTFIX)
 * ═══════════════════════════════════════════════════════════════
 * 
 * HOTFIX v2.3 :
 * ✅ Accepte les numéros commençant par indicatif SANS le "+"
 * ✅ Gère les numéros de 10 à 15 chiffres
 * ✅ Auto-ajoute "+" pour tous les indicatifs connus
 * ✅ Fallback : si indicatif inconnu mais format valide, accepter quand même
 * 
 * EXEMPLES MAINTENANT ACCEPTÉS :
 * ✅ 2250747094746  → +2250747094746 (CI - 13 chiffres)
 * ✅ 2250876436790  → +2250876436790 (CI - 13 chiffres)
 * ✅ 225 07 47 09 47 46 → +2250747094746
 * ✅ +2250747094746 → +2250747094746 (déjà formaté)
 */

/**
 * Normalize phone number for WhatsApp
 * @param {string} phone - Raw phone number from user
 * @param {string} defaultCountryCode - Default country code to add if missing (ex: '225')
 * @returns {string|null} - Normalized phone with "+" or null if invalid
 */
function normalizePhoneNumber(phone, defaultCountryCode = '225') {
    if (!phone) return null

    let normalized = phone.toString().trim()

    // 1. NETTOYER : Supprimer espaces, tirets, parenthèses, points
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '')

    // 2. CONVERTIR "00" → "+" (préfixe international)
    if (normalized.startsWith('00')) {
        normalized = '+' + normalized.substring(2)
    }

    // 3. Si déjà avec "+", vérifier le format
    if (normalized.startsWith('+')) {
        const digitsOnly = normalized.substring(1)
        if (/^\d{10,15}$/.test(digitsOnly)) {
            console.log(`✅ Phone already formatted: "${phone}" → "${normalized}"`)
            return normalized
        } else {
            console.warn(`⚠️ PHONE REJECTED: Invalid digit count after "+": ${phone}`)
            return null
        }
    }

    // 4. AUTO-AJOUTER "+" pour les indicatifs pays connus
    // Liste étendue des indicatifs africains et internationaux courants
    const knownCountryCodes = [
        // Afrique de l'Ouest
        '225',  // Côte d'Ivoire
        '221',  // Sénégal
        '223',  // Mali
        '226',  // Burkina Faso
        '227',  // Niger
        '228',  // Togo
        '229',  // Bénin
        '233',  // Ghana
        '234',  // Nigeria
        // Afrique Centrale
        '237',  // Cameroun
        '241',  // Gabon
        '242',  // Congo
        '243',  // RDC
        // Afrique du Nord
        '212',  // Maroc
        '213',  // Algérie
        '216',  // Tunisie
        // Europe
        '33',   // France
        '32',   // Belgique
        '41',   // Suisse
        '44',   // UK
        '49',   // Allemagne
        // Autres
        '1',    // USA/Canada
        '91',   // Inde
    ]

    // Trier par longueur décroissante pour matcher les indicatifs longs d'abord (ex: 225 avant 22)
    const sortedCodes = knownCountryCodes.sort((a, b) => b.length - a.length)

    for (const code of sortedCodes) {
        if (normalized.startsWith(code)) {
            // Vérifier que le reste du numéro est valide (7-12 chiffres après l'indicatif)
            const restOfNumber = normalized.substring(code.length)
            if (restOfNumber.length >= 7 && restOfNumber.length <= 12 && /^\d+$/.test(restOfNumber)) {
                normalized = '+' + normalized
                console.log(`✅ Phone Normalized (code ${code}): "${phone}" → "${normalized}"`)
                return normalized
            }
        }
    }

    // 5. FALLBACK : Si le numéro ressemble à un numéro local (8-10 chiffres), ajouter l'indicatif par défaut
    if (/^\d{8,10}$/.test(normalized)) {
        // Numéro local sans indicatif - ajouter le code pays par défaut
        normalized = '+' + defaultCountryCode + normalized
        console.log(`✅ Phone Normalized (added default ${defaultCountryCode}): "${phone}" → "${normalized}"`)
        return normalized
    }

    // 6. FALLBACK ULTIME : Si le numéro a entre 10 et 15 chiffres, l'accepter avec "+"
    // Cela permet d'accepter des indicatifs non listés
    if (/^\d{10,15}$/.test(normalized)) {
        normalized = '+' + normalized
        console.log(`⚠️ Phone Normalized (unknown country code): "${phone}" → "${normalized}"`)
        return normalized
    }

    // 7. REJET : Format invalide
    console.warn(`❌ PHONE REJECTED: Invalid format: "${phone}" → cleaned: "${normalized}"`)
    return null
}

module.exports = { normalizePhoneNumber }
