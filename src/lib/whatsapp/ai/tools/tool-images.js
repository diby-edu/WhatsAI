
const { findMatchingOption, getOptionValue } = require('./tool-helpers')

async function handleSendImage(args, products) {
    try {
        console.log('🛠️ Executing tool: send_image')
        let { product_name, variant_value, selected_variants } = args

        // Normalisation des arguments
        if (variant_value && !selected_variants) {
            console.log(`⚠️ Legacy variant_value used: "${variant_value}"`)
        }

        const searchName = product_name.toLowerCase()
        const product = products.find(p =>
            p.name.toLowerCase() === searchName ||
            searchName.includes(p.name.toLowerCase()) ||
            p.name.toLowerCase().includes(searchName)
        )

        if (!product) {
            return JSON.stringify({ success: false, error: `Produit "${product_name}" introuvable.` })
        }

        let imageUrl = product.image_url
        let foundVariantName = null

        // 1. Chercher image spécifique si variantes
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
            caption: caption,
            product_name: product.name
        })

    } catch (error) {
        console.error('❌ Send Image Error:', error)
        return JSON.stringify({ success: false, error: 'Erreur lors de l\'envoi.' })
    }
}

module.exports = { handleSendImage }
