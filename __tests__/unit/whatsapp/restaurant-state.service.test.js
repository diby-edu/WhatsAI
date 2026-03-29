const {
    RESTAURANT_STAGE,
    buildRestaurantStateGuidance,
    hasRestaurantStateData,
    inferRestaurantStateFromAssistantMessage,
    mergeRestaurantStateIntoToolArgs,
    updateRestaurantStateFromUserMessage,
} = require('../../../src/lib/whatsapp/services/restaurant-state.service')

describe('restaurant-state.service', () => {
    const restaurantProducts = [
        {
            id: 'prod_1',
            name: 'Poulet braise',
            price_fcfa: 4500,
            menu_section_slug: 'mains',
            category: 'Plats'
        }
    ]

    test('captures takeaway items and asks for the next missing customer field', () => {
        const result = updateRestaurantStateFromUserMessage(
            {},
            'Je veux 2 poulet braise a emporter',
            restaurantProducts
        )

        expect(result.state.mode).toBe('takeaway')
        expect(result.state.stage).toBe(RESTAURANT_STAGE.COLLECTING)
        expect(result.state.items).toHaveLength(1)
        expect(result.state.items[0].product_name).toBe('Poulet braise')
        expect(result.state.items[0].quantity).toBe(2)
        expect(result.state.awaiting_field?.type).toBe('customer_name')
        expect(result.directReply).toMatch(/nom complet/i)
    })

    test('builds recap for booking_only then transitions to READY on confirmation', () => {
        let state = {}

        state = updateRestaurantStateFromUserMessage(state, 'Je veux reserver une table', restaurantProducts).state
        state = updateRestaurantStateFromUserMessage(state, '2026-04-10', restaurantProducts).state
        state = updateRestaurantStateFromUserMessage(state, '20h00', restaurantProducts).state
        state = updateRestaurantStateFromUserMessage(state, 'pour 4 personnes', restaurantProducts).state
        state = updateRestaurantStateFromUserMessage(state, 'Awa Konan', restaurantProducts).state
        state = updateRestaurantStateFromUserMessage(state, '+2250701020304', restaurantProducts).state
        state = updateRestaurantStateFromUserMessage(state, 'sur place', restaurantProducts).state

        const beforeRecap = updateRestaurantStateFromUserMessage(state, 'non', restaurantProducts)
        expect(beforeRecap.state.stage).toBe(RESTAURANT_STAGE.RECAP)
        expect(beforeRecap.directReply).toMatch(/recapitulatif/i)
        expect(beforeRecap.directReply).toMatch(/Confirmez-vous/i)

        const confirmed = updateRestaurantStateFromUserMessage(beforeRecap.state, 'oui', restaurantProducts)
        expect(confirmed.state.stage).toBe(RESTAURANT_STAGE.READY)
        expect(confirmed.state.awaiting_field).toBeNull()
    })

    test('merges collected state into create_restaurant_checkout args', () => {
        const state = {
            stage: RESTAURANT_STAGE.READY,
            mode: 'delivery',
            items: [{ product_name: 'Poulet braise', quantity: 2 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            delivery_address: 'Cocody Riviera 2',
            payment_method: 'online',
            notes: 'Sans piment'
        }

        const merged = mergeRestaurantStateIntoToolArgs('create_restaurant_checkout', {}, state)
        expect(merged.fulfillment_mode).toBe('delivery')
        expect(merged.customer_name).toBe('Awa Konan')
        expect(merged.customer_phone).toBe('+2250701020304')
        expect(merged.delivery_address).toBe('Cocody Riviera 2')
        expect(merged.payment_method).toBe('online')
        expect(merged.notes).toBe('Sans piment')
        expect(merged.items).toEqual([{ product_name: 'Poulet braise', quantity: 2 }])
    })

    test('clears the state after a successful restaurant confirmation message', () => {
        const previousState = {
            stage: RESTAURANT_STAGE.READY,
            mode: 'dine_in',
            items: [{ product_name: 'Poulet braise', quantity: 1 }]
        }

        const nextState = inferRestaurantStateFromAssistantMessage(
            'Reservation restaurant enregistree pour le client.',
            previousState
        )

        expect(hasRestaurantStateData(nextState)).toBe(false)
        expect(nextState.stage).toBe(RESTAURANT_STAGE.IDLE)
    })

    test('guidance tells the model to call the tool immediately when state is READY', () => {
        const guidance = buildRestaurantStateGuidance({
            stage: RESTAURANT_STAGE.READY,
            mode: 'takeaway',
            items: [{ product_name: 'Poulet braise', quantity: 1 }],
            customer_name: 'Awa',
            customer_phone: '+2250701020304',
            payment_method: 'onsite'
        })

        expect(guidance).toMatch(/create_restaurant_checkout maintenant/i)
        expect(guidance).toMatch(/Ne pose pas une nouvelle question/i)
    })
})
