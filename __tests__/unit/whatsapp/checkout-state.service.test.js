const {
    CHECKOUT_STAGE,
    prepareCheckoutStateForCartEdit,
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

    test('preserves collected checkout fields when returning to the cart for edits', () => {
        const previousState = {
            stage: CHECKOUT_STAGE.CONFIRMATION,
            pending_fields: [],
            awaiting_field: {
                type: 'confirmation',
                label: 'confirmation',
                prompt: 'Confirmez-vous cette commande ?',
            },
            collected: {
                customer_name: 'Koffi Diby',
                customer_phone: '+2250700000000',
                email: 'koffi@example.com',
                delivery_address: null,
                payment_method: 'online',
                notes: null,
            },
            note_declined: false,
            customer_recap_confirmed: true,
        }

        const cartState = {
            stage: 'cart_recap',
            cart_items: [
                {
                    product_id: 'p1',
                    product_name: 'Mini-cours Excel',
                    quantity: 1,
                    unit_price: 25,
                    line_total: 25,
                    selected_variants: {},
                },
                {
                    product_id: 'p2',
                    product_name: "Pack Fonds d'écran",
                    quantity: 2,
                    unit_price: 50,
                    line_total: 100,
                    selected_variants: {},
                },
            ],
        }

        const nextState = prepareCheckoutStateForCartEdit(previousState, cartState, [
            { id: 'p1', name: 'Mini-cours Excel', product_type: 'digital', price_fcfa: 25 },
            { id: 'p2', name: "Pack Fonds d'écran", product_type: 'digital', price_fcfa: 50 },
        ])

        expect(nextState.stage).toBe(CHECKOUT_STAGE.CUSTOMER_RECAP)
        expect(nextState.awaiting_field?.type).toBe('customer_recap')
        expect(nextState.collected.customer_name).toBe('Koffi Diby')
        expect(nextState.collected.customer_phone).toBe('+2250700000000')
        expect(nextState.collected.email).toBe('koffi@example.com')
        expect(nextState.customer_recap_confirmed).toBe(false)
    })
})
