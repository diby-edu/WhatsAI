
// ═══════════════════════════════════════════════════════════════
// 📞 HELPER : NORMALIZE PHONE NUMBER
// ═══════════════════════════════════════════════════════════════
function normalizePhoneNumber(phone) {
    if (!phone) return null

    let normalized = phone.toString().trim()
    normalized = normalized.replace(/[\s\-\(\)\.]/g, '')

    if (!normalized) return null

    if (normalized.startsWith('00')) {
        normalized = '+' + normalized.substring(2)
    }

    if (normalized.startsWith('+')) {
        return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null
    }

    if (!/^\d+$/.test(normalized)) return null

    // Numéro local ambigu sans indicatif explicite -> rejet
    if (normalized.startsWith('0')) return null

    // Sans "+", on n'accepte que les numéros déjà internationaux.
    // Min 11 chiffres pour éviter d'accepter silencieusement des formats locaux.
    if (/^[1-9]\d{10,14}$/.test(normalized)) {
        return '+' + normalized
    }

    return null
}

function normalizeWhatsAppContact(rawContact) {
    if (!rawContact) return null

    const contact = String(rawContact).trim()
    const base = contact.includes('@') ? contact.split('@')[0] : contact
    const digitsOnly = base.replace(/[^\d+]/g, '')

    return normalizePhoneNumber(digitsOnly)
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
    // Les produits numériques n'ont pas de variantes exploitables par le bot
    if (product.product_type === 'digital') return false

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
    shoe_size: 'pointure',
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
    normalizeWhatsAppContact,
    sanitizeForLog,
    productHasRealVariants,
    checkStock,
    getOptionValue,
    getOptionPrice,
    findMatchingOption,
    VARIANT_CATEGORY_LABELS
}
