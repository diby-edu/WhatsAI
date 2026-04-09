const {
    CHECKOUT_STAGE,
    updateCheckoutStateFromUserMessage,
} = require('../../../src/lib/whatsapp/services/checkout-state.service')

describe('checkout-state.service', () => {
    test('lets AI answer a knowledge-base question without losing the digital checkout step', () => {
        const previousState = {
            stage: CHECKOUT_STAGE.CUSTOMER_FIELDS,
            pending_fields: ['email'],
            awaiting_field: {
                type: 'email',
                label: 'adresse email',
                prompt: 'Quelle est votre adresse email ?',
            },
            collected: {
                customer_name: 'Koffi Diby',
                customer_phone: '+2250700000000',
                email: null,
                delivery_address: null,
                payment_method: 'online',
                notes: null,
            },
            note_declined: false,
            customer_recap_confirmed: false,
        }

        const cartState = {
            stage: 'checkout',
            cart_items: [
                {
                    product_id: 'p1',
                    product_name: 'Guide PDF - Trouver un emploi',
                    quantity: 1,
                    unit_price: 150,
                    line_total: 150,
                    selected_variants: {},
                },
            ],
        }

        const update = updateCheckoutStateFromUserMessage(
            previousState,
            "C'est quoi exactement ce guide ?",
            {
                cartState,
                products: [
                    { id: 'p1', name: 'Guide PDF - Trouver un emploi', product_type: 'digital', price_fcfa: 150 },
                ],
                allowKnowledgeInterrupt: true,
            }
        )

        expect(update.questionDetected).toBe(true)
        expect(update.shouldBypassAI).toBe(false)
        expect(update.state.stage).toBe(CHECKOUT_STAGE.CUSTOMER_FIELDS)
        expect(update.state.awaiting_field?.type).toBe('email')
        expect(update.state.collected.email).toBeNull()
    })
})
