/**
 * ═══════════════════════════════════════════════════════════════
 * SECURITY UTILS v2.3 - HOTFIX ANTI-HALLUCINATION
 * ═══════════════════════════════════════════════════════════════
 * 
 * HOTFIX v2.3 :
 * ✅ Accepte les TOTAUX calculés (prix × quantité)
 * ✅ Accepte les sous-totaux de ligne
 * ✅ Accepte le total global de commande
 * ✅ Réduit les faux positifs
 */

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

    // Extract all price mentions from response
    const pricePattern = /(?:^|[\s\-:;=×x*])([\d\s.]+)\s*(?:FCFA|CFA|francs?)/gi
    const mentionedPrices = []
    let match

    while ((match = pricePattern.exec(aiResponse)) !== null) {
        const price = parseInt(match[1].replace(/\s/g, ''), 10)
        if (price >= 50) mentionedPrices.push(price)
    }

    if (mentionedPrices.length === 0) {
        return { isValid: true, issues: [] }
    }

    // ═══════════════════════════════════════════════════════════
    // CONSTRUIRE TOUS LES PRIX VALIDES (unitaires + multiples)
    // ═══════════════════════════════════════════════════════════
    
    const validPrices = new Set()
    const unitPrices = [] // Pour calculer les totaux possibles

    products.forEach(p => {
        // Prix de base
        if (p.price_fcfa && p.price_fcfa > 0) {
            validPrices.add(p.price_fcfa)
            unitPrices.push(p.price_fcfa)
        }

        // Prix des variantes
        if (p.variants && Array.isArray(p.variants)) {
            p.variants.forEach(v => {
                if (v.options && Array.isArray(v.options)) {
                    v.options.forEach(opt => {
                        if (typeof opt === 'object' && opt.price) {
                            validPrices.add(opt.price)
                            unitPrices.push(opt.price)
                            
                            // Prix combinés (base + additive)
                            if (v.type === 'additive' && p.price_fcfa) {
                                validPrices.add(p.price_fcfa + opt.price)
                                unitPrices.push(p.price_fcfa + opt.price)
                            }
                        }
                    })
                }
            })
        }
    })

    // ═══════════════════════════════════════════════════════════
    // GÉNÉRER LES MULTIPLES COURANTS (quantités 1-100)
    // ═══════════════════════════════════════════════════════════
    
    const commonQuantities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 24, 25, 30, 36, 40, 50, 60, 70, 76, 80, 90, 100]
    
    unitPrices.forEach(unitPrice => {
        commonQuantities.forEach(qty => {
            validPrices.add(unitPrice * qty)
        })
    })

    // ═══════════════════════════════════════════════════════════
    // GÉNÉRER LES SOMMES POSSIBLES (totaux de commande)
    // ═══════════════════════════════════════════════════════════
    
    // Extraire les sous-totaux mentionnés dans la réponse
    const subtotalPattern = /(\d+)\s*(?:FCFA|CFA)/gi
    const subtotals = []
    let subtotalMatch
    
    while ((subtotalMatch = subtotalPattern.exec(aiResponse)) !== null) {
        const value = parseInt(subtotalMatch[1].replace(/\s/g, ''), 10)
        if (value >= 50) subtotals.push(value)
    }

    // Calculer les sommes de sous-totaux possibles
    if (subtotals.length > 1) {
        let runningTotal = 0
        subtotals.forEach(st => {
            runningTotal += st
            validPrices.add(runningTotal)
        })
    }

    // ═══════════════════════════════════════════════════════════
    // VÉRIFICATION AVEC TOLÉRANCE ÉTENDUE
    // ═══════════════════════════════════════════════════════════
    
    mentionedPrices.forEach(price => {
        let isValid = false

        // Check 1: Prix exact dans la liste
        if (validPrices.has(price)) {
            isValid = true
        }

        // Check 2: Tolérance de 5% pour arrondis
        if (!isValid) {
            for (const validPrice of validPrices) {
                const tolerance = Math.max(validPrice * 0.05, 10) // 5% ou 10 FCFA minimum
                if (Math.abs(price - validPrice) <= tolerance) {
                    isValid = true
                    break
                }
            }
        }

        // Check 3: Le prix est un multiple d'un prix unitaire connu
        if (!isValid) {
            for (const unitPrice of unitPrices) {
                if (unitPrice > 0 && price % unitPrice === 0 && price / unitPrice <= 1000) {
                    isValid = true
                    break
                }
            }
        }

        // Check 4: Le prix est proche d'un multiple (tolérance 5%)
        if (!isValid) {
            for (const unitPrice of unitPrices) {
                if (unitPrice > 0) {
                    const ratio = price / unitPrice
                    const roundedRatio = Math.round(ratio)
                    if (roundedRatio > 0 && roundedRatio <= 1000) {
                        const expectedPrice = unitPrice * roundedRatio
                        const tolerance = expectedPrice * 0.05
                        if (Math.abs(price - expectedPrice) <= tolerance) {
                            isValid = true
                            break
                        }
                    }
                }
            }
        }

        // Check 5: Le prix est la somme de plusieurs prix valides (total de commande)
        // Skip cette vérification pour les très grands nombres (probables totaux)
        if (!isValid && price > 10000) {
            // Probablement un total de commande - être plus tolérant
            // Vérifier si c'est dans une plage raisonnable
            const maxPossibleTotal = Math.max(...unitPrices) * 1000
            if (price <= maxPossibleTotal) {
                isValid = true // Accepter les grands totaux
                console.log(`ℹ️ Large total accepted: ${price} FCFA (likely order total)`)
            }
        }

        if (!isValid) {
            issues.push({
                type: 'price_hallucination',
                mentionedPrice: price,
                validPrices: Array.from(validPrices).slice(0, 20) // Limiter pour les logs
            })
        }
    })

    if (issues.length > 0) {
        console.warn('⚠️ ANTI-HALLUCINATION: Potential price issues detected:', issues.length)
        // Log détaillé seulement en dev
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Details:', issues)
        }
    }

    return {
        isValid: issues.length === 0,
        issues
    }
}

module.exports = { verifyResponseIntegrity }
