
const { findMatchingOption, getOptionValue } = require('./tool-helpers')

/**
 * Distance de Levenshtein — mesure la similarité entre deux mots
 * Permet de matcher "techno" ↔ "tecno", "samsug" ↔ "samsung", etc.
 */
function levenshtein(a, b) {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => {
            if (i === 0) return j
            if (j === 0) return i
            return 0
        })
    )
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        }
    }
    return dp[m][n]
}

/**
 * Vérifie si needle est "fuzzy-présent" dans haystack.
 * Priorité : match exact, puis word-by-word avec tolérance Levenshtein.
 */
function fuzzyIncludes(haystack, needle) {
    if (haystack.includes(needle)) return true
    const haystackWords = haystack.split(/\s+/)
    const needleWords = needle.split(/\s+/).filter(w => w.length > 2)
    return needleWords.some(nw => {
        if (haystack.includes(nw)) return true
        // Tolérance : 1 faute pour mots courts (≤6), 2 fautes pour mots longs
        const maxDist = nw.length <= 6 ? 1 : 2
        return haystackWords.some(hw => levenshtein(nw, hw) <= maxDist)
    })
}

async function handleSendImage(args, products, relevantDocs) {
    try {
        console.log('🛠️ Executing tool: send_image')
        let { product_name, variant_value, selected_variants, image_url: directUrl } = args

        // Cas 1 : URL directe fournie par l'IA (depuis la KB)
        if (directUrl) {
            console.log(`📸 Image directe KB: ${directUrl}`)
            return JSON.stringify({
                success: true,
                action: 'send_image',
                image_url: directUrl,
                caption: product_name || '',
            })
        }

        // Cas 2 : Chercher dans la KB (mode support) — fuzzy match label ou contenu
        if (relevantDocs && relevantDocs.length > 0 && product_name) {
            const searchName = product_name.toLowerCase()

            // Chercher d'abord dans les extra_image_urls avec labels
            for (const doc of relevantDocs) {
                const extras = Array.isArray(doc.extra_image_urls) ? doc.extra_image_urls : []
                for (const item of extras) {
                    const url = typeof item === 'string' ? item : item?.url
                    const label = typeof item === 'string' ? null : item?.label
                    if (url && label && fuzzyIncludes(label.toLowerCase(), searchName)) {
                        console.log(`📸 Image extra KB trouvée pour "${product_name}" — label: "${label}"`)
                        return JSON.stringify({
                            success: true,
                            action: 'send_image',
                            image_url: url,
                            caption: label,
                            product_name: label,
                        })
                    }
                }
            }

            // Chercher par image_label sur l'image principale
            for (const doc of relevantDocs) {
                if (doc.image_url && doc.image_label && fuzzyIncludes(doc.image_label.toLowerCase(), searchName)) {
                    console.log(`📸 Image principale KB trouvée par label "${doc.image_label}" pour "${product_name}"`)
                    return JSON.stringify({
                        success: true,
                        action: 'send_image',
                        image_url: doc.image_url,
                        caption: doc.image_label,
                        product_name: doc.image_label,
                    })
                }
            }

            // Fallback : match sur titre ou contenu (uniquement si doc sans extra images)
            const kbDoc = relevantDocs.find(d =>
                d.image_url && (
                    fuzzyIncludes(d.content.toLowerCase(), searchName) ||
                    (d.title && fuzzyIncludes(d.title.toLowerCase(), searchName))
                )
            )
            if (kbDoc) {
                const hasMultipleImages = kbDoc.image_label || (Array.isArray(kbDoc.extra_image_urls) && kbDoc.extra_image_urls.length > 0)
                if (!hasMultipleImages) {
                    console.log(`📸 Image principale KB trouvée pour "${product_name}"`)
                    return JSON.stringify({
                        success: true,
                        action: 'send_image',
                        image_url: kbDoc.image_url,
                        caption: `Voici ${product_name} !`,
                        product_name: product_name,
                    })
                }
            }
        }

        // Cas 3 : Chercher dans les produits (mode catalogue)
        if (!product_name) {
            return JSON.stringify({ success: false, error: 'Nom du produit requis.' })
        }

        if (variant_value && !selected_variants) {
            console.log(`⚠️ Legacy variant_value used: "${variant_value}"`)
        }

        const searchName = product_name.toLowerCase()
        const product = (products || []).find(p =>
            p.name.toLowerCase() === searchName ||
            searchName.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(searchName)
        )

        if (!product) {
            return JSON.stringify({ success: false, error: `Produit "${product_name}" introuvable.` })
        }

        let imageUrl = product.image_url
        let foundVariantName = null

        if (product.variants && (selected_variants || variant_value)) {
            for (const variant of product.variants) {
                let targetValue = null
                if (selected_variants) {
                    const entry = Object.entries(selected_variants).find(([k]) => k.toLowerCase() === variant.name.toLowerCase())
                    if (entry) targetValue = entry[1]
                }
                if (!targetValue && variant_value) targetValue = variant_value
                if (targetValue) {
                    const validOption = findMatchingOption(variant, targetValue)
                    if (validOption && typeof validOption === 'object' && validOption.image) {
                        imageUrl = validOption.image
                        foundVariantName = getOptionValue(validOption)
                        console.log(`✅ Image variante trouvée pour "${variant.name}": ${foundVariantName}`)
                        break
                    }
                }
            }
        }

        if (!imageUrl) {
            return JSON.stringify({ success: false, error: `Pas d'image pour "${product.name}".` })
        }

        const caption = foundVariantName
            ? `Voici ${product.name} (${foundVariantName}) !`
            : `Voici ${product.name} !`

        console.log(`📸 Image à envoyer: ${product.name} ${foundVariantName ? `(${foundVariantName})` : ''}`)

        return JSON.stringify({
            success: true,
            action: 'send_image',
            image_url: imageUrl,
            caption,
            product_name: product.name
        })

    } catch (error) {
        console.error('❌ Send Image Error:', error)
        return JSON.stringify({ success: false, error: 'Erreur lors de l\'envoi.' })
    }
}

module.exports = { handleSendImage }
