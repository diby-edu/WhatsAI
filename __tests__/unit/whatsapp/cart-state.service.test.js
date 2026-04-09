const {
    CART_STAGE,
    inferCartStateFromAssistantMessage,
    updateCartStateFromUserMessage,
} = require('../../../src/lib/whatsapp/services/cart-state.service')

describe('cart-state.service', () => {
    test('does not infer checkout from an AI reply when no cart line exists yet', () => {
        const previousState = {
            stage: CART_STAGE.COLLECTING_ITEM,
            cart_items: [],
            draft_item: {
                product_id: 'p1',
                product_name: 'Guide PDF',
                quantity: null,
                selected_variants: {},
                selected_variants_by_id: {},
                skipped_optional_variant_ids: [],
            },
            awaiting_field: { type: 'quantity', label: 'quantite' },
            last_prompt_kind: CART_STAGE.COLLECTING_ITEM,
            last_prompt_text: 'Combien souhaitez-vous en commander ?',
        }

        const nextState = inferCartStateFromAssistantMessage(
            `Merci ! Pour finaliser votre commande, j'ai besoin de quelques informations :

1. Votre nom complet.
2. Votre numéro de téléphone.
3. Votre adresse de livraison complète.
4. Votre mode de paiement (Mobile Money, carte, ou cash à la livraison).`,
            previousState,
            [{ id: 'p1', name: 'Guide PDF', product_type: 'digital' }]
        )

        expect(nextState.stage).toBe(CART_STAGE.COLLECTING_ITEM)
        expect(nextState.last_prompt_kind).toBe(CART_STAGE.COLLECTING_ITEM)
    })

    test('still infers checkout from an AI reply when a real cart line already exists', () => {
        const previousState = {
            stage: CART_STAGE.CART_RECAP,
            cart_items: [
                {
                    id: 'line-1',
                    product_id: 'p1',
                    product_name: 'Guide PDF',
                    quantity: 1,
                    unit_price_fcfa: 1500,
                    line_total: 1500,
                    selected_variants: {},
                },
            ],
            draft_item: null,
            awaiting_field: null,
            last_prompt_kind: CART_STAGE.CART_RECAP,
            last_prompt_text: 'On continue ?',
        }

        const nextState = inferCartStateFromAssistantMessage(
            `Pour finaliser, j'ai besoin de votre nom complet, votre numéro de téléphone et votre adresse email.`,
            previousState,
            [{ id: 'p1', name: 'Guide PDF', product_type: 'digital' }]
        )

        expect(nextState.stage).toBe(CART_STAGE.CHECKOUT)
        expect(nextState.last_prompt_kind).toBe(CART_STAGE.CHECKOUT)
    })

    test('matches a short product alias like "je veux le guide" without falling back to AI', () => {
        const update = updateCartStateFromUserMessage(
            {},
            'je veux le guide',
            [
                { id: 'p1', name: 'Guide PDF - Trouver un emploi', product_type: 'digital', price_fcfa: 150 },
                { id: 'p2', name: 'Logiciel Antivirus', product_type: 'digital', price_fcfa: 200 },
            ]
        )

        expect(update.shouldBypassAI).toBe(true)
        expect(update.state.stage).toBe(CART_STAGE.COLLECTING_ITEM)
        expect(update.directReply).toContain('Combien souhaitez-vous en commander ?')
    })

    test('goes straight to checkout after quantity for a digital-only cart', () => {
        const initial = updateCartStateFromUserMessage(
            {},
            'guide pdf',
            [
                { id: 'p1', name: 'Guide PDF - Trouver un emploi', product_type: 'digital', price_fcfa: 150 },
            ]
        )

        const next = updateCartStateFromUserMessage(
            initial.state,
            '1',
            [
                { id: 'p1', name: 'Guide PDF - Trouver un emploi', product_type: 'digital', price_fcfa: 150 },
            ]
        )

        expect(next.state.stage).toBe(CART_STAGE.CHECKOUT)
        expect(next.state.cart_items).toHaveLength(1)
        expect(next.directReply).toBeNull()
        expect(next.shouldBypassAI).toBe(false)
    })

    test('lets AI answer a knowledge question without losing the digital cart step', () => {
        const initial = updateCartStateFromUserMessage(
            {},
            'guide pdf',
            [
                { id: 'p1', name: 'Guide PDF - Trouver un emploi', product_type: 'digital', price_fcfa: 150 },
            ]
        )

        const next = updateCartStateFromUserMessage(
            initial.state,
            "C'est quoi exactement ce guide ?",
            [
                { id: 'p1', name: 'Guide PDF - Trouver un emploi', product_type: 'digital', price_fcfa: 150 },
            ],
            'XOF',
            { allowKnowledgeInterrupt: true }
        )

        expect(next.questionDetected).toBe(true)
        expect(next.shouldBypassAI).toBe(false)
        expect(next.state.stage).toBe(CART_STAGE.COLLECTING_ITEM)
        expect(next.state.awaiting_field?.type).toBe('quantity')
    })
})
