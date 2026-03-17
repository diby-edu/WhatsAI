
const { findMatchingOption, getOptionValue, getOptionPrice, productHasRealVariants, VARIANT_CATEGORY_LABELS } = require('./tool-helpers')

function getVariantDisplayName(variant) {
    if (!variant) return 'Variante'
    return variant.customName || variant.name || VARIANT_CATEGORY_LABELS[variant.category] || 'Variante'
}

/**
 * Calcule le prix unitaire d'un produit en fonction de ses variantes
 * @param {Object} product - Le produit brut de la DB
 * @param {Object} selectedVariantsMap - Map des variantes choisies (ex: {"Taille": "Petite"})
 * @param {string} productNameSearch - Nom du produit tel que tapé par l'IA (pour fallback)
 * @param {number} quantity - Quantite demandee
 * @returns {Object} { price, variantOptionName, error, missingVariants, logs, matchedCombination, combinationAttributes }
 */
function calculateItemPrice(product, selectedVariantsMap = {}, productNameSearch = '', quantity = 1) {
    const logs = []
    let price = product.price_fcfa || 0
    let effectiveBasePrice = price
    let totalSupplements = 0
    let matchedVariantOption = null
    let matchedCombination = null
    let combinationAttributes = null

    // Si pas de variantes réelles, retour direct
    if (!productHasRealVariants(product)) {
        logs.push(`ℹ️ Produit SANS variantes - Prix base: ${price} FCFA`)
        return { price, variantOptionName: null, logs, matchedCombination: null, combinationAttributes: null }
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
                const variantName = getVariantDisplayName(pv).toLowerCase()
                const categoryLabel = (VARIANT_CATEGORY_LABELS[pv.category] || '').toLowerCase()
                const nameMatch = variantName === kLower
                const catMatch = categoryLabel === kLower
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
            // Chercher la combinaison correspondante SANS filtrer sur available
            // pour détecter les combinaisons explicitement désactivées
            const matchingCombo = product.combinations.find(c => {
                if (!c.attributes) return false
                return selectedGroupIds.every(gId => c.attributes[gId] === attrMap[gId])
            })

            if (matchingCombo) {
                matchedCombination = matchingCombo
                combinationAttributes = attrMap
            }

            // Combinaison trouvée mais désactivée → erreur explicite
            if (matchingCombo && matchingCombo.available === false) {
                const comboLabel = product.variants.map(v => matchedById[v.id]).filter(Boolean).join(' + ')
                logs.push(`🚫 Combinaison "${comboLabel}" désactivée`)
                return {
                    price: 0,
                    variantOptionName: null,
                    error: `La combinaison "${comboLabel}" n'est pas disponible pour "${product.name}". Proposez une autre combinaison au client.`,
                    logs,
                    matchedCombination,
                    combinationAttributes
                }
            }

            if (matchingCombo && matchingCombo.stock != null && matchingCombo.stock >= 0 && matchingCombo.stock < quantity) {
                const comboLabel = product.variants.map(v => matchedById[v.id]).filter(Boolean).join(' + ')
                logs.push(`📦 Stock combinaison insuffisant: ${matchingCombo.stock} restant(s)`)
                return {
                    price: 0,
                    variantOptionName: null,
                    error: `Stock insuffisant pour la combinaison "${comboLabel}" de "${product.name}". Seulement ${matchingCombo.stock} disponible(s).`,
                    logs,
                    matchedCombination,
                    combinationAttributes
                }
            }

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
                        return `${getVariantDisplayName(v)}: [${opts}]`
                    }).join(' | ')
                    return {
                        price: 0,
                        variantOptionName: null,
                        error: `VARIANTES MANQUANTES pour "${product.name}". Demandez: ${missingList}`,
                        missingVariants,
                        logs,
                        matchedCombination,
                        combinationAttributes
                    }
                }

                matchedVariantOption = product.variants.map(v => matchedById[v.id]).filter(Boolean).join(', ')
                logs.push(`✅ Variants validés: ${matchedVariantOption}`)
                logs.push(`💵 Prix depuis combinaison: ${price} FCFA`)
                return {
                    price,
                    variantOptionName: matchedVariantOption,
                    error: null,
                    logs,
                    matchedCombination,
                    combinationAttributes
                }
            }

            if (matchingCombo) {
                logs.push('ℹ️ Combinaison trouvée sans prix spécifique, fallback sur le calcul des options')
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
                    logs.push(`➕ Supplément "${getVariantDisplayName(variant)}": +${optionPrice} FCFA`)
                } else {
                    if (optionPrice > 0) {
                        effectiveBasePrice = optionPrice
                        logs.push(`🔄 Remplacement Base "${getVariantDisplayName(variant)}": ${optionPrice} FCFA`)
                    } else {
                        logs.push(`⏹️ Maintien Base "${getVariantDisplayName(variant)}": (0 FCFA)`)
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
            return `${getVariantDisplayName(v)}: [${opts}]`
        }).join(' | ')

        return {
            price: 0,
            variantOptionName: null,
            error: `VARIANTES MANQUANTES pour "${product.name}". Demandez: ${missingList}`,
            missingVariants,
            logs,
            matchedCombination,
            combinationAttributes
        }
    }

    logs.push(`✅ Variants validés: ${matchedVariantOption}`)
    logs.push(`💵 Prix calculé: ${effectiveBasePrice} (Base) + ${totalSupplements} (Supp) = ${price} FCFA`)

    return {
        price,
        variantOptionName: matchedVariantOption,
        error: null,
        logs,
        matchedCombination,
        combinationAttributes
    }
}

module.exports = { calculateItemPrice }
