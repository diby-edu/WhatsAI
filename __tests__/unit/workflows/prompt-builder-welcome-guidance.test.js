const { buildAdaptiveSystemPrompt } = require('../../../src/lib/whatsapp/ai/prompt-builder')

describe('Prompt Builder Welcome Guidance', () => {
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

    test('instructs the first catalogue message to include the diplomatic guidance line', () => {
        const products = [
            { id: '1', name: 'Mini-cours Excel', price_fcfa: 15000, product_type: 'digital' }
        ]

        const prompt = buildAdaptiveSystemPrompt(
            mockAgent,
            products,
            mockOrders,
            mockDocs,
            currency,
            gpsLink,
            formattedHours
        )

        expect(prompt).toContain('Pour une meilleure prise en charge, vous pouvez repondre directement a la question affichee.')
    })

    test('includes the escalation phone in the first catalogue guidance when configured', () => {
        const products = [
            { id: '1', name: 'Mini-cours Excel', price_fcfa: 15000, product_type: 'digital' }
        ]

        const prompt = buildAdaptiveSystemPrompt(
            {
                ...mockAgent,
                escalation_phone: '+2250102030405'
            },
            products,
            mockOrders,
            mockDocs,
            currency,
            gpsLink,
            formattedHours
        )

        expect(prompt).toContain('Pour toute autre demande, contactez le service client au +225 01 02 03 04 05.')
    })
})
