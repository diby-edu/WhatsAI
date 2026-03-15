
const { findMatchingOption, getOptionValue, getOptionPrice, productHasRealVariants, VARIANT_CATEGORY_LABELS } = require('./tool-helpers')

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
    const variants = product.variants

    // Utilise l'ID du groupe comme clé pour éviter les collisions
    // quand plusieurs groupes portent le même name (ex: deux "Couleur").
    // matchedById = { variantId: selectedValue }
    const matchedById = {}

    // 1. Fusionner les sources de variantes
    // A. Explicit selection (priorité) — matching par valeur pour désambiguïser
    if (selectedVariantsMap && typeof selectedVariantsMap === 'object') {
        Object.entries(selectedVariantsMap).forEach(([k, v]) => {
            const kLower = k.toLowerCase()
            // Trouver le groupe dont le nom ou le label catégorie correspond ET dont la valeur est valide
            const targetVariant = product.variants.find(pv => {
                if (matchedById[pv.id] !== undefined) return false // déjà attribué
                const nameMatch = pv.name.toLowerCase() === kLower
                const catMatch = (VARIANT_CATEGORY_LABELS[pv.category] || '') === kLower
                return (nameMatch || catMatch) && !!findMatchingOption(pv, v)
            })
            if (targetVariant) matchedById[targetVariant.id] = v
        })
    }

    // B. Fallback sur le productName (si l'IA a mis "Pizza Pepperoni Grande")
    product.variants.forEach(variant => {
        if (matchedById[variant.id] !== undefined) return // Déjà trouvé via A
        if (!variant.options) return

        for (const option of variant.options) {
            const optValue = getOptionValue(option)
            if (optValue && productNameSearch.toLowerCase().includes(optValue.toLowerCase())) {
                matchedById[variant.id] = optValue
                break
            }
        }
    })

    // 1.5. Lookup prix depuis les combinaisons (priorité sur les prix d'options individuels)
    // Nécessaire quand 2+ groupes PRIX FIXE ont des prix différents par combinaison
    if (product.combinations && Array.isArray(product.combinations) && product.combinations.length > 0) {
        // Convertir matchedById (groupId -> value) en attrMap (groupId -> optionId)
        const attrMap = {}
        for (const variant of product.variants) {
            const selectedValue = matchedById[variant.id]
            if (!selectedValue) continue
            const option = findMatchingOption(variant, selectedValue)
            if (option && option.id) attrMap[variant.id] = option.id
        }

        const selectedGroupIds = Object.keys(attrMap)
        if (selectedGroupIds.length > 0) {
            const matchingCombo = product.combinations.find(c => {
                if (!c.attributes || c.available === false) return false
                // La combinaison doit correspondre à tous les attributs sélectionnés
                return selectedGroupIds.every(gId => c.attributes[gId] === attrMap[gId])
            })

            if (matchingCombo && matchingCombo.price != null && matchingCombo.price > 0) {
                logs.push(`🔗 Prix combinaison: ${matchingCombo.price} FCFA`)
                price = matchingCombo.price

                const missingVariants = variants.filter(v =>
                    v.options && v.options.length > 0 &&
                    matchedById[v.id] === undefined &&
                    v.type !== 'supplement' && v.type !== 'additive'
                )
                if (missingVariants.length > 0) {
                    const missingList = missingVariants.map(v => {
                        const opts = v.options.map(o => getOptionValue(o)).join(', ')
                        return `${v.name}: [${opts}]`
                    }).join(' | ')
                    return { price: 0, variantOptionName: null, error: `VARIANTES MANQUANTES pour "${product.name}". Demandez: ${missingList}`, missingVariants, logs }
                }

                matchedVariantOption = product.variants.map(v => matchedById[v.id]).filter(Boolean).join(', ')
                logs.push(`✅ Variants validés: ${matchedVariantOption}`)
                logs.push(`💵 Prix depuis combinaison: ${price} FCFA`)
                return { price, variantOptionName: matchedVariantOption, error: null, logs }
            }
        }
    }

    // 2. Calcul du prix (fallback sur options individuelles si pas de combinaison avec prix)
    for (const variant of product.variants) {
        const selectedValue = matchedById[variant.id]
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
                matchedById[variant.id] = getOptionValue(validOption)
            }
        }
    }

    // 3. Résultat Final
    price = effectiveBasePrice + totalSupplements
    matchedVariantOption = product.variants
        .map(v => matchedById[v.id])
        .filter(Boolean)
        .join(', ')

    // 4. Missing Check
    const missingVariants = variants.filter(v =>
        v.options &&
        v.options.length > 0 &&
        matchedById[v.id] === undefined &&
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
