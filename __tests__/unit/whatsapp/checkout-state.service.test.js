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

    test('returns directly to the final order recap when cart edits keep the same confirmed customer info', () => {
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

        expect(nextState.stage).toBe(CHECKOUT_STAGE.CONFIRMATION)
        expect(nextState.awaiting_field?.type).toBe('confirmation')
        expect(nextState.collected.customer_name).toBe('Koffi Diby')
        expect(nextState.collected.customer_phone).toBe('+2250700000000')
        expect(nextState.collected.email).toBe('koffi@example.com')
        expect(nextState.customer_recap_confirmed).toBe(true)
    })

    test('does not treat the quantity message as a checkout menu choice when cart just re-enters checkout', () => {
        const previousState = {
            stage: CHECKOUT_STAGE.CUSTOMER_RECAP,
            pending_fields: [],
            awaiting_field: {
                type: 'customer_recap',
                label: 'recap informations client',
                prompt: null,
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
            customer_recap_confirmed: false,
        }

        const cartState = {
            stage: 'checkout',
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

        const update = updateCheckoutStateFromUserMessage(previousState, '2', {
            cartState,
            products: [
                { id: 'p1', name: 'Mini-cours Excel', product_type: 'digital', price_fcfa: 25 },
                { id: 'p2', name: "Pack Fonds d'écran", product_type: 'digital', price_fcfa: 50 },
            ],
            activateCheckout: true,
        })

        expect(update.shouldBypassAI).toBe(true)
        expect(update.state.stage).toBe(CHECKOUT_STAGE.CUSTOMER_RECAP)
        expect(update.state.awaiting_field?.type).toBe('customer_recap')
        expect(update.directReply).toContain('Vos informations :')
        expect(update.directReply).not.toContain('Que souhaitez-vous modifier ?')
    })

    test('reuses the previous customer details when the client says the same name, phone and email', () => {
        const cartState = {
            stage: 'checkout',
            cart_items: [
                {
                    product_id: 'p1',
                    product_name: 'Licences Antivirus',
                    quantity: 2,
                    unit_price: 25,
                    line_total: 50,
                    selected_variants: {},
                },
            ],
        }

        const products = [
            {
                id: 'p1',
                name: 'Licences Antivirus',
                product_type: 'digital',
                price_fcfa: 25,
                license_keys: [{ key: 'aaa-aaa', used: false }],
            },
        ]

        const recentCustomerProfile = {
            customer_name: 'Alfonso diby',
            customer_phone: '+33088483993',
            email: 'kondhjjz@gmail.com',
        }

        const startState = {
            stage: CHECKOUT_STAGE.CUSTOMER_FIELDS,
            pending_fields: ['customer_name', 'customer_phone', 'email'],
            awaiting_field: {
                type: 'customer_name',
                label: 'nom complet',
                prompt: 'Quel est votre nom complet ? (ex : Koffi Diby)',
            },
            collected: {
                customer_name: null,
                customer_phone: null,
                email: null,
                delivery_address: null,
                payment_method: 'online',
                notes: null,
            },
            note_declined: false,
            customer_recap_confirmed: false,
        }

        const nameUpdate = updateCheckoutStateFromUserMessage(startState, 'Le même nom', {
            cartState,
            products,
            recentCustomerProfile,
        })
        expect(nameUpdate.state.collected.customer_name).toBe('Alfonso diby')
        expect(nameUpdate.state.awaiting_field?.type).toBe('customer_phone')

        const phoneUpdate = updateCheckoutStateFromUserMessage(nameUpdate.state, 'Le même numéro', {
            cartState,
            products,
            recentCustomerProfile,
        })
        expect(phoneUpdate.state.collected.customer_phone).toBe('+33088483993')
        expect(phoneUpdate.state.awaiting_field?.type).toBe('email')

        const emailUpdate = updateCheckoutStateFromUserMessage(phoneUpdate.state, 'La même adresse', {
            cartState,
            products,
            recentCustomerProfile,
        })
        expect(emailUpdate.state.collected.email).toBe('kondhjjz@gmail.com')
        expect(emailUpdate.state.stage).toBe(CHECKOUT_STAGE.CUSTOMER_RECAP)
        expect(emailUpdate.directReply).toContain('Vos informations :')
        expect(emailUpdate.directReply).toContain('Alfonso diby')
        expect(emailUpdate.directReply).toContain('+33088483993')
        expect(emailUpdate.directReply).toContain('kondhjjz@gmail.com')
    })

    test('explains that a phone number needs a country code when the client sends a local format', () => {
        const previousState = {
            stage: CHECKOUT_STAGE.CUSTOMER_FIELDS,
            pending_fields: ['customer_phone', 'email'],
            awaiting_field: {
                type: 'customer_phone',
                label: 'numero de telephone',
                prompt: 'Quel est votre numero de telephone avec indicatif ? (ex : +2250700000000)',
            },
            collected: {
                customer_name: 'Koffi Diby',
                customer_phone: null,
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
                    product_name: 'Mini-cours Excel',
                    quantity: 1,
                    unit_price: 25,
                    line_total: 25,
                    selected_variants: {},
                },
            ],
        }

        const update = updateCheckoutStateFromUserMessage(previousState, '0788291023', {
            cartState,
            products: [
                { id: 'p1', name: 'Mini-cours Excel', product_type: 'digital', price_fcfa: 25 },
            ],
        })

        expect(update.shouldBypassAI).toBe(true)
        expect(update.state.collected.customer_phone).toBeNull()
        expect(update.state.awaiting_field?.type).toBe('customer_phone')
        expect(update.directReply).toContain("indicatif pays")
    })

    test('normalizes accented email addresses when the client sends a complete email', () => {
        const previousState = {
            stage: CHECKOUT_STAGE.CUSTOMER_FIELDS,
            pending_fields: ['email'],
            awaiting_field: {
                type: 'email',
                label: 'adresse email',
                prompt: 'Quelle est votre adresse email ? (ex : koffi@gmail.com)',
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
                    product_name: 'Mini-cours Excel',
                    quantity: 1,
                    unit_price: 25,
                    line_total: 25,
                    selected_variants: {},
                },
            ],
        }

        const update = updateCheckoutStateFromUserMessage(previousState, 'Touré@gmail.com', {
            cartState,
            products: [
                { id: 'p1', name: 'Mini-cours Excel', product_type: 'digital', price_fcfa: 25 },
            ],
        })

        expect(update.state.collected.email).toBe('toure@gmail.com')
        expect(update.state.stage).toBe(CHECKOUT_STAGE.CUSTOMER_RECAP)
        expect(update.directReply).toContain('toure@gmail.com')
    })
})
