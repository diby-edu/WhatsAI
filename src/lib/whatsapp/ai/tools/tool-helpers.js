
// ═══════════════════════════════════════════════════════════════
// 📞 HELPER : NORMALIZE PHONE NUMBER
// ═══════════════════════════════════════════════════════════════
function normalizePhoneNumber(phone, defaultCountryCode = '225') {
    if (!phone) {
        return '+000000000000'
    }

    let normalized = phone.toString().trim()
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '')

    if (normalized.startsWith('00')) normalized = '+' + normalized.substring(2)
    if (normalized.startsWith('+')) return normalized

    const countryPatterns = [{ prefix: '225' }, { prefix: '33' }, { prefix: '1' }]
    for (const pattern of countryPatterns) {
        if (normalized.startsWith(pattern.prefix)) return '+' + normalized
    }

    if (normalized.startsWith('0') && normalized.length >= 8) {
        return '+' + defaultCountryCode + normalized.substring(1)
    }

    return '+' + defaultCountryCode + normalized.replace(/\D/g, '')
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
    findMatchingOption
}
