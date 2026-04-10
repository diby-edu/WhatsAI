const { buildInboundTextVariants } = require('../../../src/lib/whatsapp/handlers/message-text')
const { updateCheckoutStateFromUserMessage, CHECKOUT_STAGE } = require('../../../src/lib/whatsapp/services/checkout-state.service')

describe('message handler text variants', () => {
    test('keeps the quoted reply context out of the structured flow text', () => {
        const result = buildInboundTextVariants(
            'saloni@gmail.com',
            'Parfait ! Quelle est votre adresse email ? (ex : koffi@gmail.com)'
        )

        expect(result.structuredText).toBe('saloni@gmail.com')
        expect(result.aiText).toContain('En réponse à')
        expect(result.aiText).toContain('koffi@gmail.com')
        expect(result.aiText).toContain('saloni@gmail.com')
    })

    test('uses the real replied email instead of the quoted example during checkout parsing', () => {
        const previousState = {
            stage: CHECKOUT_STAGE.CUSTOMER_FIELDS,
            pending_fields: ['email'],
            awaiting_field: {
                type: 'email',
                label: 'adresse email',
                prompt: 'Quelle est votre adresse email ? (ex : koffi@gmail.com)',
            },
            collected: {
                customer_name: 'Lyama diby',
                customer_phone: '+760876445780',
                email: null,
                delivery_address: null,
                payment_method: null,
                notes: null,
            },
            note_declined: false,
            customer_recap_confirmed: false,
        }

        const cartState = {
            stage: 'checkout',
            cart_items: [
                {
                    product_id: 'av',
                    product_name: 'Logiciel Antivirus',
                    quantity: 4,
                    unit_price: 75,
                    line_total: 300,
                    selected_variants: {},
                    selected_variants_by_id: {},
                },
            ],
        }

        const { structuredText } = buildInboundTextVariants(
            'saloni@gmail.com',
            'Parfait ! Quelle est votre adresse email ? (ex : koffi@gmail.com)'
        )

        const update = updateCheckoutStateFromUserMessage(previousState, structuredText, {
            cartState,
            products: [
                {
                    id: 'av',
                    name: 'Logiciel Antivirus',
                    product_type: 'digital',
                    price_fcfa: 75,
                    license_keys: [{ key: 'aaa-aaa', used: false }],
                },
            ],
        })

        expect(update.state.stage).toBe(CHECKOUT_STAGE.CUSTOMER_RECAP)
        expect(update.state.collected.email).toBe('saloni@gmail.com')
        expect(update.directReply).toContain('saloni@gmail.com')
        expect(update.directReply).not.toContain('koffi@gmail.com')
    })
})
