const { recoverInterruptedCheckoutFromHistory } = require('../../../src/lib/whatsapp/handlers/interrupted-checkout-recovery')

describe('interrupted-checkout-recovery', () => {
    const products = [
        {
            id: 'av',
            name: 'Logiciel Antivirus',
            product_type: 'digital',
            price_fcfa: 75,
            license_keys: [
                { key: 'aaa', used: false },
                { key: 'bbb', used: false },
                { key: 'ccc', used: false },
                { key: 'ddd', used: false },
            ],
        },
    ]

    test('rebuilds the checkout after a lost state when the customer answers the name prompt later', () => {
        const history = [
            {
                role: 'user',
                content: 'Je veux 4 logiciels antivirus',
                created_at: '2026-04-10T21:52:00.000Z',
            },
            {
                role: 'assistant',
                content: 'Quel est votre nom complet ? (ex : Koffi Diby)',
                created_at: '2026-04-10T21:52:05.000Z',
            },
            {
                role: 'user',
                content: 'Assi dji',
                created_at: '2026-04-10T22:46:00.000Z',
            },
        ]

        const recovered = recoverInterruptedCheckoutFromHistory(
            history,
            'Assi dji',
            products,
            'XOF'
        )

        expect(recovered).not.toBeNull()
        expect(recovered.cartState.cart_items).toHaveLength(1)
        expect(recovered.cartState.cart_items[0].quantity).toBe(4)
        expect(recovered.checkoutState.collected.customer_name).toBe('Assi dji')
        expect(recovered.checkoutUpdate.shouldBypassAI).toBe(true)
        expect(recovered.checkoutUpdate.directReply).toContain('Quel est votre numero de telephone')
    })

    test('ignores a generic catalog assistant reply', () => {
        const history = [
            {
                role: 'user',
                content: 'Bonjour',
                created_at: '2026-04-10T21:52:00.000Z',
            },
            {
                role: 'assistant',
                content: 'Bienvenue chez KONO ONLINE ! Voici notre catalogue.',
                created_at: '2026-04-10T21:52:05.000Z',
            },
            {
                role: 'user',
                content: 'Assi dji',
                created_at: '2026-04-10T22:46:00.000Z',
            },
        ]

        const recovered = recoverInterruptedCheckoutFromHistory(
            history,
            'Assi dji',
            products,
            'XOF'
        )

        expect(recovered).toBeNull()
    })
})
