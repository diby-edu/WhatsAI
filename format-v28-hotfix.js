/**
 * ═══════════════════════════════════════════════════════════════
 * WHATSAPP UTILITY : PHONE NUMBER FORMATTER (v2.8 - HOTFIX)
 * ═══════════════════════════════════════════════════════════════
 * 
 * HOTFIX v2.8 :
 * ✅ Accepte TOUS les formats de numéro
 * ✅ Ne rejette JAMAIS un numéro (fallback avec tel quel)
 * ✅ Auto-normalise les indicatifs
 * ✅ Gère les numéros avec 0 initial (ex: 0747094746)
 */

/**
 * Normalize phone number for WhatsApp
 * @param {string} phone - Raw phone number from user
 * @param {string} defaultCountryCode - Default country code (ex: '225' for CI)
 * @returns {string} - Normalized phone (NEVER returns null)
 */
function normalizePhoneNumber(phone, defaultCountryCode = '225') {
    if (!phone) {
        console.warn('⚠️ Phone empty, using placeholder')
        return '+000000000000' // Placeholder pour éviter le crash
    }

    let normalized = phone.toString().trim()

    // 1. NETTOYER : Supprimer espaces, tirets, parenthèses, points
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '')

    // 2. CONVERTIR "00" en "+" (préfixe international)
    if (normalized.startsWith('00')) {
        normalized = '+' + normalized.substring(2)
    }

    // 3. Si déjà avec "+", valider et retourner
    if (normalized.startsWith('+')) {
        // Vérifier qu'il y a assez de chiffres
        const digitsOnly = normalized.substring(1)
        if (/^\d{8,15}$/.test(digitsOnly)) {
            console.log(`✅ Phone OK: "${phone}" → "${normalized}"`)
            return normalized
        }
        // Même si format bizarre, on garde car on ne veut pas bloquer
        console.log(`⚠️ Phone format unusual but accepted: "${phone}" → "${normalized}"`)
        return normalized
    }

    // 4. INDICATIFS CONNUS - Ajouter "+"
    const countryPatterns = [
        { prefix: '225', minLen: 10 }, // Côte d'Ivoire (225 + 10 chiffres)
        { prefix: '221', minLen: 9 },  // Sénégal
        { prefix: '223', minLen: 8 },  // Mali
        { prefix: '226', minLen: 8 },  // Burkina Faso
        { prefix: '227', minLen: 8 },  // Niger
        { prefix: '228', minLen: 8 },  // Togo
        { prefix: '229', minLen: 8 },  // Bénin
        { prefix: '233', minLen: 9 },  // Ghana
        { prefix: '234', minLen: 10 }, // Nigeria
        { prefix: '237', minLen: 9 },  // Cameroun
        { prefix: '241', minLen: 7 },  // Gabon
        { prefix: '242', minLen: 9 },  // Congo
        { prefix: '243', minLen: 9 },  // RDC
        { prefix: '212', minLen: 9 },  // Maroc
        { prefix: '213', minLen: 9 },  // Algérie
        { prefix: '216', minLen: 8 },  // Tunisie
        { prefix: '33', minLen: 9 },   // France
        { prefix: '32', minLen: 9 },   // Belgique
        { prefix: '41', minLen: 9 },   // Suisse
        { prefix: '44', minLen: 10 },  // UK
        { prefix: '49', minLen: 10 },  // Allemagne
        { prefix: '1', minLen: 10 },   // USA/Canada
    ]

    // Trier par longueur de préfixe décroissante pour matcher les longs d'abord
    countryPatterns.sort((a, b) => b.prefix.length - a.prefix.length)

    for (const pattern of countryPatterns) {
        if (normalized.startsWith(pattern.prefix)) {
            const restLen = normalized.length - pattern.prefix.length
            if (restLen >= 7) { // Au moins 7 chiffres après l'indicatif
                normalized = '+' + normalized
                console.log(`✅ Phone normalized (${pattern.prefix}): "${phone}" → "${normalized}"`)
                return normalized
            }
        }
    }

    // 5. NUMÉRO LOCAL (commence par 0) - Ajouter indicatif par défaut
    if (normalized.startsWith('0') && normalized.length >= 8) {
        // Supprimer le 0 et ajouter l'indicatif
        normalized = '+' + defaultCountryCode + normalized.substring(1)
        console.log(`✅ Phone normalized (local→+${defaultCountryCode}): "${phone}" → "${normalized}"`)
        return normalized
    }

    // 6. NUMÉRO SANS 0 ET SANS INDICATIF - Supposer local et ajouter indicatif
    if (/^\d{8,10}$/.test(normalized)) {
        normalized = '+' + defaultCountryCode + normalized
        console.log(`✅ Phone normalized (assumed local): "${phone}" → "${normalized}"`)
        return normalized
    }

    // 7. FALLBACK ULTIME : Ajouter "+" si c'est un numéro avec assez de chiffres
    if (/^\d{10,15}$/.test(normalized)) {
        normalized = '+' + normalized
        console.log(`⚠️ Phone normalized (fallback): "${phone}" → "${normalized}"`)
        return normalized
    }

    // 8. DERNIER RECOURS : Retourner tel quel avec "+" (ne JAMAIS bloquer)
    if (!normalized.startsWith('+')) {
        normalized = '+' + defaultCountryCode + normalized.replace(/\D/g, '')
    }
    
    console.log(`⚠️ Phone accepted as-is (last resort): "${phone}" → "${normalized}"`)
    return normalized
}

module.exports = { normalizePhoneNumber }
