const { buildAdaptiveSystemPrompt } = require('../../../src/lib/whatsapp/ai/prompt-builder')

describe('Prompt Builder Digital Guardrails', () => {
    const mockAgent = {
        name: 'Test Shop',
        language: 'français',
        use_emojis: true,
        business_address: 'Abidjan, Cocody',
        business_hours: { lundi: '9h-18h' },
    }

    const mockOrders = []
    const mockDocs = []
    const currency = 'FCFA'
    const gpsLink = 'https://maps.google.com/test'
    const formattedHours = 'Lundi: 9h-18h'

    test('keeps a polluted digital product out of the restaurant engine', () => {
        const products = [
            { id: '1', name: 'Guide PDF', price_fcfa: 15000, product_type: 'digital', service_subtype: 'restaurant' }
        ]

        const prompt = buildAdaptiveSystemPrompt(
            mockAgent,
            products,
            mockOrders,
            mockDocs,
            currency,
            gpsLink,
            formattedHours,
            false,
            'je veux guide pdf'
        )

        expect(prompt).toContain('Ce catalogue vend uniquement des produits numeriques')
        expect(prompt).toContain('FLUX DE COMMANDE (MODE PRODUIT NUMERIQUE)')
        expect(prompt).toContain('Ne demande jamais d\'adresse de livraison physique')
        expect(prompt).not.toMatch(/create_restaurant_checkout|booking_only/i)
    })

    test('adds hard digital constraints even if the agent mission still mentions delivery and cash on delivery', () => {
        const products = [
            { id: '1', name: 'Mini-cours Excel', price_fcfa: 10000, product_type: 'digital' }
        ]

        const prompt = buildAdaptiveSystemPrompt(
            {
                ...mockAgent,
                system_prompt: `Tu dois demander l'adresse de livraison complète et proposer cash à la livraison.`
            },
            products,
            mockOrders,
            mockDocs,
            currency,
            gpsLink,
            formattedHours
        )

        expect(prompt).toContain('Ignore toute ancienne instruction parlant d\'adresse de livraison')
        expect(prompt).toContain('payment_method est TOUJOURS "online"')
        expect(prompt).toContain('N\'annonce jamais "cash a la livraison" pour un produit numerique')
    })
})
