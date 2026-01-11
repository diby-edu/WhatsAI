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

    // Extract all price mentions from response (numbers followed by FCFA, F, or currency symbols)
    const pricePattern = /(\d[\d\s]*(?:\d{3})*)\s*(?:FCFA|F|CFA|€|\$)/gi
    const mentionedPrices = []
    let match

    while ((match = pricePattern.exec(aiResponse)) !== null) {
        const price = parseInt(match[1].replace(/\s/g, ''), 10)
        if (price > 0) mentionedPrices.push(price)
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
    mentionedPrices.forEach(price => {
        let isValid = false
        for (const validPrice of validPrices) {
            const tolerance = validPrice * 0.05 // 5% tolerance
            if (Math.abs(price - validPrice) <= tolerance) {
                isValid = true
                break
            }
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
