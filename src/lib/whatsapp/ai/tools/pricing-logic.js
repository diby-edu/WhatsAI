
const { findMatchingOption, getOptionValue, getOptionPrice, productHasRealVariants } = require('./tool-helpers')

/**
 * Calcule le prix unitaire d'un produit en fonction de ses variantes
 * @param {Object} product - Le produit brut de la DB
 * @param {Object} selectedVariantsMap - Map des variantes choisies (ex: {"Taille": "Petite"})
 * @param {string} productNameSearch - Nom du produit tel que tapé par l'IA (pour fallback)
 * @returns {Object} { price, variantOptionName, error, missingVariants, logs }
 */
function calculateItemPrice(product, selectedVariantsMap = {}, productNameSearch = '') {
    const logs = []
    let price = product.price_fcfa || 0
    let effectiveBasePrice = price
    let totalSupplements = 0
    let matchedVariantOption = null

    // Si pas de variantes réelles, retour direct
    if (!productHasRealVariants(product)) {
        logs.push(`ℹ️ Produit SANS variantes - Prix base: ${price} FCFA`)
        return { price, variantOptionName: null, logs }
    }

    logs.push(`📋 Produit avec variantes RÉELLES`)
    let variants = product.variants
    const matchedVariantsByType = {}

    // 1. Fusionner les sources de variantes
    // A. Explicit selection (priorité)
    if (selectedVariantsMap && typeof selectedVariantsMap === 'object') {
        Object.entries(selectedVariantsMap).forEach(([k, v]) => {
            const targetVariant = product.variants.find(pv => pv.name.toLowerCase() === k.toLowerCase())
            if (targetVariant) matchedVariantsByType[targetVariant.name] = v
        })
    }

    // B. Fallback sur le nproductName (si l'IA a mis "Pizza Pepperoni Grande")
    product.variants.forEach(variant => {
        if (matchedVariantsByType[variant.name]) return // Déjà trouvé via A
        if (!variant.options) return

        for (const option of variant.options) {
            const optValue = getOptionValue(option)
            if (optValue && productNameSearch.toLowerCase().includes(optValue.toLowerCase())) {
                matchedVariantsByType[variant.name] = optValue
                break
            }
        }
    })

    // 2. Calcul du prix
    for (const variant of product.variants) {
        const selectedValue = matchedVariantsByType[variant.name]
        if (selectedValue) {
            const validOption = findMatchingOption(variant, selectedValue)
            if (validOption) {
                const optionPrice = getOptionPrice(validOption)

                if (variant.type === 'additive' || variant.type === 'supplement') {
                    totalSupplements += optionPrice
                    logs.push(`➕ Supplément "${variant.name}": +${optionPrice} FCFA`)
                } else {
                    if (optionPrice > 0) {
                        effectiveBasePrice = optionPrice
                        logs.push(`🔄 Remplacement Base "${variant.name}": ${optionPrice} FCFA`)
                    } else {
                        logs.push(`⏹️ Maintien Base "${variant.name}": (0 FCFA)`)
                    }
                }
                // Update matched value with clean name
                matchedVariantsByType[variant.name] = getOptionValue(validOption)
            }
        }
    }

    // 3. Résultat Final
    price = effectiveBasePrice + totalSupplements
    matchedVariantOption = Object.values(matchedVariantsByType).join(', ')

    // 4. Missing Check
    // On ne considère manquants que les variants qui ne sont PAS des suppléments/additifs
    const missingVariants = variants.filter(v =>
        v.options &&
        v.options.length > 0 &&
        !matchedVariantsByType[v.name] &&
        v.type !== 'supplement' &&
        v.type !== 'additive'
    )

    if (missingVariants.length > 0) {
        const missingList = missingVariants.map(v => {
            const opts = v.options.map(o => getOptionValue(o)).join(', ')
            return `${v.name}: [${opts}]`
        }).join(' | ')

        return {
            price: 0,
            variantOptionName: null,
            error: `VARIANTES MANQUANTES pour "${product.name}". Demandez: ${missingList}`,
            missingVariants,
            logs
        }
    }

    logs.push(`✅ Variants validés: ${matchedVariantOption}`)
    logs.push(`💵 Prix calculé: ${effectiveBasePrice} (Base) + ${totalSupplements} (Supp) = ${price} FCFA`)

    return {
        price,
        variantOptionName: matchedVariantOption,
        error: null,
        logs
    }
}

module.exports = { calculateItemPrice }
