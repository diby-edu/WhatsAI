const {
    findMatchingOption,
    getOptionValue,
    getOptionPrice,
    VARIANT_CATEGORY_LABELS,
} = require('./tool-helpers')
const {
    calculateDateRangeDays,
    normalizeBookingType,
} = require('../../services/booking-utils')

function getVariantDisplayName(variant) {
    if (!variant) return 'Variante'
    return variant.customName || variant.name || VARIANT_CATEGORY_LABELS[variant.category] || 'Variante'
}

function combinationMatches(attributes = {}, expected = {}) {
    const attributeKeys = Object.keys(attributes)
    const expectedKeys = Object.keys(expected)

    if (attributeKeys.length !== expectedKeys.length) return false
    return expectedKeys.every(key => attributes[key] === expected[key])
}

function resolveVariantSelection(selectedVariantsMap = {}, variant) {
    const displayName = getVariantDisplayName(variant).toLowerCase()
    const categoryLabel = (VARIANT_CATEGORY_LABELS[variant.category] || '').toLowerCase()
    const variantName = String(variant.name || '').toLowerCase()

    const entry = Object.entries(selectedVariantsMap || {}).find(([key, value]) => {
        if (!value) return false
        const normalizedKey = String(key || '').toLowerCase()
        const keyMatches =
            normalizedKey === displayName ||
            normalizedKey === categoryLabel ||
            normalizedKey === variantName

        return keyMatches && !!findMatchingOption(variant, value)
    })

    return entry ? entry[1] : null
}

function calculateServiceBookingPrice(service, input = {}) {
    const selectedVariantsMap = input.selectedVariantsMap || {}
    const selectedSupplementsMap = input.selectedSupplementsMap || {}
    const normalizedBookingType = normalizeBookingType(input.bookingType, input.serviceSubtype || service?.service_subtype)

    const fixedVariants = (service?.variants || []).filter(variant =>
        Array.isArray(variant.options) &&
        variant.options.length > 0 &&
        variant.type === 'fixed'
    )

    const optionalVariants = (service?.variants || []).filter(variant =>
        Array.isArray(variant.options) &&
        variant.options.length > 0 &&
        (variant.type === 'additive' || variant.type === 'supplement')
    )

    const fixedSelections = []
    const attrMap = {}
    let effectiveBasePrice = service?.price_fcfa || 0
    let supplementsTotal = 0
    let matchedCombination = null
    let combinationAttributes = null

    for (const variant of fixedVariants) {
        const selectedValue = resolveVariantSelection(selectedVariantsMap, variant)
        if (!selectedValue) continue

        const option = findMatchingOption(variant, selectedValue)
        if (!option) continue

        const optionValue = getOptionValue(option)
        fixedSelections.push({
            variant_id: variant.id,
            label: getVariantDisplayName(variant),
            value: optionValue,
            option_id: option.id || null,
        })

        if (option.id) {
            attrMap[variant.id] = option.id
        }
    }

    if (fixedVariants.length > 0 && fixedSelections.length < fixedVariants.length) {
        const selectedVariantIds = new Set(fixedSelections.map(selection => selection.variant_id))
        const missingFixedVariants = fixedVariants
            .filter(variant => !selectedVariantIds.has(variant.id))
            .map(variant => ({
                id: variant.id,
                label: getVariantDisplayName(variant),
                options: (variant.options || []).map(option => getOptionValue(option)).filter(Boolean),
            }))

        return {
            price: 0,
            fixedSelections,
            supplementsList: [],
            matchedCombination: null,
            combinationAttributes: null,
            missingFixedVariants,
            error: `VARIANTES MANQUANTES pour "${service.name}". Demandez: ${missingFixedVariants.map(variant => `${variant.label} (${variant.options.join(', ')})`).join(' | ')}`,
        }
    }

    if (Array.isArray(service?.combinations) && service.combinations.length > 0 && Object.keys(attrMap).length > 0) {
        const combo = service.combinations.find(candidate =>
            combinationMatches(candidate.attributes || {}, attrMap)
        )

        if (combo) {
            matchedCombination = combo
            combinationAttributes = attrMap

            if (combo.available === false) {
                return {
                    price: 0,
                    fixedSelections,
                    supplementsList: [],
                    matchedCombination,
                    combinationAttributes,
                    missingFixedVariants: [],
                    error: `La combinaison choisie n'est pas disponible pour "${service.name}".`,
                }
            }

            if (combo.price != null && combo.price > 0) {
                effectiveBasePrice = combo.price
            }
        }
    }

    if (!matchedCombination || matchedCombination.price == null || matchedCombination.price <= 0) {
        for (const selection of fixedSelections) {
            const variant = fixedVariants.find(item => item.id === selection.variant_id)
            const option = variant ? findMatchingOption(variant, selection.value) : null
            const optionPrice = option ? getOptionPrice(option) : 0
            if (optionPrice > 0) {
                effectiveBasePrice = optionPrice
            }
        }
    }

    const supplementsList = []
    for (const variant of optionalVariants) {
        const selectedFromVariantMap = resolveVariantSelection(selectedVariantsMap, variant)
        if (selectedFromVariantMap) {
            const option = findMatchingOption(variant, selectedFromVariantMap)
            if (option) {
                const optionValue = getOptionValue(option)
                const optionPrice = getOptionPrice(option)
                supplementsTotal += optionPrice
                supplementsList.push({
                    variant_id: variant.id,
                    label: getVariantDisplayName(variant),
                    value: optionValue,
                    price: optionPrice,
                })
            }
        }

        for (const option of variant.options || []) {
            const optionValue = getOptionValue(option)
            if (!selectedSupplementsMap[optionValue] || supplementsList.some(item => item.value === optionValue)) {
                continue
            }

            const optionPrice = getOptionPrice(option)
            supplementsTotal += optionPrice
            supplementsList.push({
                variant_id: variant.id,
                label: getVariantDisplayName(variant),
                value: optionValue,
                price: optionPrice,
            })
        }
    }

    let durationDays = null
    if (normalizedBookingType === 'stay' && input.preferredDate && input.endDate) {
        const duration = calculateDateRangeDays(input.preferredDate, input.endDate)
        if (duration.error) {
            return {
                price: 0,
                unitPrice: effectiveBasePrice,
                nights: null,
                fixedSelections,
                supplementsList,
                matchedCombination,
                combinationAttributes,
                missingFixedVariants: [],
                error: duration.error,
            }
        }

        durationDays = duration.days
    }

    const unitPrice = effectiveBasePrice
    const baseTotal = durationDays ? unitPrice * durationDays : unitPrice

    return {
        price: baseTotal + supplementsTotal,
        unitPrice,
        nights: durationDays,
        fixedSelections,
        supplementsList,
        matchedCombination,
        combinationAttributes,
        missingFixedVariants: [],
        error: null,
    }
}

module.exports = {
    calculateServiceBookingPrice,
    getVariantDisplayName,
}
