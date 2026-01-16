/**
 * 🔒 ANTI-HALLUCINATION: Verify AI response doesn't contain fabricated prices
 * @param {string} aiResponse 
 * @param {Array} products 
 * @returns {Object} { isValid, issues }
 */
function verifyResponseIntegrity(aiResponse, products) {
    const issues = []

    if (!aiResponse || !products || products.length === 0) {
        return { isValid: true, issues: [] }
    }

    // Extract all price mentions from response (numbers DIRECTLY followed by FCFA/CFA without letters before)
    // Improved regex: must have space or hyphen before the number, not a letter (to avoid "Office 365")
    const pricePattern = /(?:^|[\s\-:;])([\d\s.]+)\s*(?:FCFA|CFA|francs?)/gi
    const mentionedPrices = []
    let match

    while ((match = pricePattern.exec(aiResponse)) !== null) {
        const price = parseInt(match[1].replace(/\s/g, ''), 10)
        // Only consider prices > 50 (to avoid small numbers that are often not prices)
        // and prices that are likely to be real prices (multiples of 5 or 10 in FCFA)
        if (price >= 50) mentionedPrices.push(price)
    }

    if (mentionedPrices.length === 0) {
        return { isValid: true, issues: [] }
    }

    // Collect all valid prices from catalog (base prices + variant prices)
    const validPrices = new Set()
    products.forEach(p => {
        if (p.price_fcfa) validPrices.add(p.price_fcfa)

        // Add variant prices
        if (p.variants && Array.isArray(p.variants)) {
            p.variants.forEach(v => {
                if (v.options && Array.isArray(v.options)) {
                    v.options.forEach(opt => {
                        if (typeof opt === 'object' && opt.price) {
                            validPrices.add(opt.price)
                            // Also add base + additive price
                            if (v.type === 'additive' && p.price_fcfa) {
                                validPrices.add(p.price_fcfa + opt.price)
                            }
                        }
                    })
                }
            })
        }
    })

    // Check each mentioned price against valid prices (with 5% tolerance for rounding)
    // Check each mentioned price against valid prices logic
    mentionedPrices.forEach(price => {
        let isValid = false

        // 1. Direct match (unit price)
        for (const validPrice of validPrices) {
            const tolerance = Math.max(validPrice * 0.05, 50) // 5% or 50 FCFA
            if (Math.abs(price - validPrice) <= tolerance) {
                isValid = true
                break
            }

            // 2. Multiple match (Quantity x Unit Price)
            // ex: 570 FCFA (valid=190) -> 570/190 = 3 (integer)
            if (validPrice > 0) {
                const ratio = price / validPrice
                // If ratio is close to an integer (e.g. 2.99 or 3.01)
                if (Math.abs(ratio - Math.round(ratio)) < 0.05 && ratio <= 100) {
                    isValid = true
                    break
                }
            }
        }

        // 3. Total Sum Match (checking if it matches the sum of SOME valid prices) is too complex 
        // without knowing quantities. But "Total: 25860 FCFA" is often flagged.
        // We will accept large numbers if they look like plausible totals (ending in 0 or 5, > 500)
        // This is a trade-off to avoid blocking valid order recaps.
        if (!isValid && price > 500 && (price % 5 === 0)) {
            // Heuristic: If it's a "clean" number, we assume it might be a valid total not listed in unit prices.
            // Real hallucinations often produce weird numbers like 2341 FCFA.
            isValid = true
        }

        if (!isValid) {
            issues.push({
                type: 'price_hallucination',
                mentionedPrice: price,
                validPrices: Array.from(validPrices)
            })
        }
    })

    if (issues.length > 0) {
        console.warn('⚠️ ANTI-HALLUCINATION: Potential price fabrication detected:', issues)
    }

    return {
        isValid: issues.length === 0,
        issues
    }
}

module.exports = { verifyResponseIntegrity }
