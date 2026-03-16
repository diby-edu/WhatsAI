
// ═══════════════════════════════════════════════════════════════
// 📞 HELPER : NORMALIZE PHONE NUMBER
// ═══════════════════════════════════════════════════════════════
function normalizePhoneNumber(phone, defaultCountryCode = '225') {
    if (!phone) return null

    let normalized = phone.toString().trim()
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '')

    let result = null

    if (normalized.startsWith('00')) normalized = '+' + normalized.substring(2)

    if (normalized.startsWith('+')) {
        result = normalized
    } else {
        const countryPatterns = [{ prefix: '225' }, { prefix: '33' }, { prefix: '1' }]
        for (const pattern of countryPatterns) {
            if (normalized.startsWith(pattern.prefix)) {
                result = '+' + normalized
                break
            }
        }

        if (!result) {
            if (normalized.startsWith('0') && normalized.length >= 8) {
                result = '+' + defaultCountryCode + normalized.substring(1)
            } else {
                result = '+' + defaultCountryCode + normalized.replace(/\D/g, '')
            }
        }
    }

    // Validation finale : minimum 8 chiffres obligatoires
    // Bloque les téléphones malformés (ex: 'abc' → '+225' → 3 chiffres → null)
    const digitCount = (result || '').replace(/\D/g, '').length
    return digitCount >= 8 ? result : null
}

// ═══════════════════════════════════════════════════════════════
// 🔒 HELPER : MASQUAGE DONNÉES SENSIBLES (RGPD)
// ═══════════════════════════════════════════════════════════════
function sanitizeForLog(obj) {
    if (!obj || typeof obj !== 'object') return obj
    const sanitized = { ...obj }

    if (sanitized.customer_phone) {
        sanitized.customer_phone = sanitized.customer_phone.slice(0, 5) + '****'
    }

    if (sanitized.delivery_address) {
        sanitized.delivery_address = '[MASKED]'
    }

    if (sanitized.email) {
        const parts = sanitized.email.split('@')
        sanitized.email = parts[0].slice(0, 2) + '***@' + (parts[1] || '')
    }

    return sanitized
}

// ═══════════════════════════════════════════════════════════════
// 🔧 HELPER : CHECK VARIANTS & STOCK
// ═══════════════════════════════════════════════════════════════
function productHasRealVariants(product) {
    if (!product.variants) return false
    if (!Array.isArray(product.variants)) return false
    if (product.variants.length === 0) return false

    for (const variant of product.variants) {
        if (!variant.options || !Array.isArray(variant.options) || variant.options.length === 0) {
            continue
        }
        return true
    }
    return false
}

function checkStock(product, quantity) {
    if (product.stock_quantity === -1 || product.stock_quantity === null || product.stock_quantity === undefined) {
        return { ok: true, available: Infinity, message: 'Stock illimité' }
    }

    if (product.stock_quantity >= quantity) {
        return { ok: true, available: product.stock_quantity, message: 'Stock OK' }
    }

    return {
        ok: false,
        available: product.stock_quantity,
        message: `Stock insuffisant. Disponible: ${product.stock_quantity}, Demandé: ${quantity}`
    }
}

// ═══════════════════════════════════════════════════════════════
// 🔧 CONSTANTE : LABELS DE CATÉGORIE (minuscules)
// Utilisée pour matcher les clés de selected_variants aux groupes
// quand le nom en DB diffère du label affiché dans le prompt.
// Ex: groupe {name:"Couleur", category:"size"} → label "taille"
// ═══════════════════════════════════════════════════════════════
const VARIANT_CATEGORY_LABELS = {
    visual: 'couleur',
    size: 'taille',
    weight: 'poids',
    duration: 'durée',
    room_type: 'type de chambre',
    view: 'vue',
    pension: 'pension',
    menu: 'menu',
    formula: 'formule',
    service_type: 'type de service',
    vehicle: 'véhicule',
    option: 'option',
    participants: 'participants',
    version: 'version',
    format: 'format',
    language: 'langue',
    license: 'licence',
}

// ═══════════════════════════════════════════════════════════════
// 🔧 HELPER : VARIANT MATCHING
// ═══════════════════════════════════════════════════════════════
function getOptionValue(option) {
    return (typeof option === 'string') ? option : (option.value || option.name || '')
}

function getOptionPrice(option) {
    return (typeof option === 'string') ? 0 : (option.price || 0)
}

/**
 * Trouve l'option correspondante avec tolérance (Accents/Case/Partial)
 */
function findMatchingOption(variant, clientValue) {
    if (!clientValue || !variant || !variant.options) return null

    // Normalisation helper
    const normalize = (str) => str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève accents
        .trim()

    const clientNorm = normalize(clientValue)

    // 1. Exact Match (après normalisation)
    const exact = variant.options.find(opt => {
        const val = typeof opt === 'string' ? opt : (opt.value || opt)
        return normalize(String(val)) === clientNorm
    })
    if (exact) return exact

    // 2. Partial Match ("marine" -> "bleu marine")
    const partial = variant.options.find(opt => {
        const val = typeof opt === 'string' ? opt : (opt.value || opt)
        const valNorm = normalize(String(val))
        return valNorm.includes(clientNorm) || clientNorm.includes(valNorm)
    })

    return partial || null
}

module.exports = {
    normalizePhoneNumber,
    sanitizeForLog,
    productHasRealVariants,
    checkStock,
    getOptionValue,
    getOptionPrice,
    findMatchingOption,
    VARIANT_CATEGORY_LABELS
}
