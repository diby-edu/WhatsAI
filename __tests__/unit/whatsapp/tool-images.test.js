/**
 * Tests for send_image tool (tool-images.js)
 *
 * Critical tests to ensure:
 * - Correct per-variant image is returned (color-specific images)
 * - Typos in variant values are tolerated (existing findMatchingOption behavior)
 * - Typos in the product name itself are tolerated without false-matching
 *   a different product that happens to share a generic word (e.g. "enfant")
 * - An unrelated product name never falls back to a wrong product
 */

const { handleSendImage } = require('../../../src/lib/whatsapp/ai/tools/tool-images')

const PRODUCTS = [
    {
        name: 'sac enfant',
        image_url: 'https://cdn.test/sac-base.png',
        variants: [
            {
                id: 'v1',
                name: 'Couleur',
                options: [
                    { id: 'o1', value: 'Bleu', image: 'https://cdn.test/sac-bleu.png', price: 5000 },
                    { id: 'o2', value: 'Jaune', image: 'https://cdn.test/sac-jaune.png', price: 6000 },
                    { id: 'o3', value: 'Noir', image: 'https://cdn.test/sac-noir.png', price: 7000 },
                ],
            },
        ],
    },
    {
        name: 'goube enfant', // typo delibere du marchand pour "gourde" (cas reel observe)
        image_url: 'https://cdn.test/goube-base.png',
        variants: [
            {
                id: 'v2',
                name: 'Couleur',
                options: [
                    { id: 'o4', value: 'Rouge', image: 'https://cdn.test/goube-rouge.png', price: 9000 },
                    { id: 'o5', value: 'Bleu', image: 'https://cdn.test/goube-bleu.png', price: 6500 },
                ],
            },
        ],
    },
]

describe('send_image tool', () => {
    test('returns the correct variant image for an exact product + color match', async () => {
        const result = JSON.parse(await handleSendImage(
            { product_name: 'goube enfant', selected_variants: { Couleur: 'Rouge' } },
            PRODUCTS, null
        ))
        expect(result.success).toBe(true)
        expect(result.image_url).toBe('https://cdn.test/goube-rouge.png')
    })

    test('distinguishes two products with the same colors correctly', async () => {
        const sacBleu = JSON.parse(await handleSendImage(
            { product_name: 'sac enfant', selected_variants: { Couleur: 'Bleu' } },
            PRODUCTS, null
        ))
        const goubeBleu = JSON.parse(await handleSendImage(
            { product_name: 'goube enfant', selected_variants: { Couleur: 'Bleu' } },
            PRODUCTS, null
        ))
        expect(sacBleu.image_url).toBe('https://cdn.test/sac-bleu.png')
        expect(goubeBleu.image_url).toBe('https://cdn.test/goube-bleu.png')
        expect(sacBleu.image_url).not.toBe(goubeBleu.image_url)
    })

    test('tolerates a typo/gender variation in the variant value (legacy variant_value field)', async () => {
        const result = JSON.parse(await handleSendImage(
            { product_name: 'sac enfant', variant_value: 'noire' },
            PRODUCTS, null
        ))
        expect(result.success).toBe(true)
        expect(result.image_url).toBe('https://cdn.test/sac-noir.png')
    })

    test('tolerates a typo in the product name without matching the wrong product via a shared generic word', async () => {
        // "gourde enfant" (orthographe correcte) doit matcher "goube enfant" (typo
        // du marchand) et PAS "sac enfant" — bien que les deux partagent le mot
        // générique "enfant".
        const result = JSON.parse(await handleSendImage(
            { product_name: 'gourde enfant', selected_variants: { Couleur: 'rouge' } },
            PRODUCTS, null
        ))
        expect(result.success).toBe(true)
        expect(result.image_url).toBe('https://cdn.test/goube-rouge.png')
    })

    test('does not fall back to an unrelated product for a name that does not resemble any catalog entry', async () => {
        const result = JSON.parse(await handleSendImage(
            { product_name: 'telephone samsung' },
            PRODUCTS, null
        ))
        expect(result.success).toBe(false)
    })

    test('falls back to the base product image when no variant is specified', async () => {
        const result = JSON.parse(await handleSendImage(
            { product_name: 'sac enfant' },
            PRODUCTS, null
        ))
        expect(result.success).toBe(true)
        expect(result.image_url).toBe('https://cdn.test/sac-base.png')
    })

    test('rejects a hallucinated image_url provided by the AI and falls back to the real catalog image', async () => {
        // Cas reel observe en production : l'IA invente une URL plausible
        // (https://example.com/...) alors qu'aucune base de connaissance ne la
        // justifie. Le paramètre image_url doit être ignoré, pas fait confiance.
        const result = JSON.parse(await handleSendImage(
            { product_name: 'goube enfant', selected_variants: { Couleur: 'Rouge' }, image_url: 'https://example.com/goube-enfant.jpg' },
            PRODUCTS, []
        ))
        expect(result.success).toBe(true)
        expect(result.image_url).toBe('https://cdn.test/goube-rouge.png')
        expect(result.image_url).not.toBe('https://example.com/goube-enfant.jpg')
    })

    test('accepts image_url when it genuinely matches an image in the knowledge base', async () => {
        const relevantDocs = [{ content: 'doc', image_url: 'https://real-kb.test/photo.jpg', image_label: 'Photo boutique' }]
        const result = JSON.parse(await handleSendImage(
            { product_name: 'Photo boutique', image_url: 'https://real-kb.test/photo.jpg' },
            [], relevantDocs
        ))
        expect(result.success).toBe(true)
        expect(result.image_url).toBe('https://real-kb.test/photo.jpg')
    })
})
