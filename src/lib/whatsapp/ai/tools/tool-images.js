
const { findMatchingOption, getOptionValue } = require('./tool-helpers')

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

        // Cas 2 : Chercher dans la KB (mode support)
        if (relevantDocs && relevantDocs.length > 0 && product_name) {
            const searchName = product_name.toLowerCase()
            const kbDoc = relevantDocs.find(d =>
                d.image_url && (
                    d.content.toLowerCase().includes(searchName) ||
                    searchName.split(' ').some(word => word.length > 3 && d.content.toLowerCase().includes(word))
                )
            )
            if (kbDoc) {
                console.log(`📸 Image trouvée dans KB pour "${product_name}"`)
                return JSON.stringify({
                    success: true,
                    action: 'send_image',
                    image_url: kbDoc.image_url,
                    caption: `Voici ${product_name} !`,
                })
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
