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
            name: 'Plat 01',
            price_fcfa: 6500,
            menu_section_slug: 'mains',
            description: 'Plat principal',
        },
        {
            id: 'prod_2',
            name: 'Dessert 01',
            price_fcfa: 2200,
            menu_section_slug: 'desserts',
            description: 'Dessert',
        },
        {
            id: 'prod_3',
            name: 'Boisson 01',
            price_fcfa: 1200,
            menu_section_slug: 'drinks',
            description: 'Boisson',
        },
    ]

    test('captures compact booking request fields in a single message', () => {
        const result = updateRestaurantStateFromUserMessage(
            {},
            'Je veux reserver une table demain a 20h pour 4 personnes',
            restaurantProducts
        )

        expect(result.state.stage).toBe(RESTAURANT_STAGE.CUSTOMER_FLOW)
        expect(result.state.fulfillment_mode).toBe('booking_only')
        expect(result.state.customer_flow.scheduled_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(result.state.customer_flow.scheduled_time).toBe('20:00')
        expect(result.state.customer_flow.party_size).toBe(4)
        expect(result.state.awaiting_cf_field?.type).toBe('notes')
        expect(result.directReply).toMatch(/demandes particuli/i)
    })

    test('asks only for the missing time when the date is already captured', () => {
        const result = updateRestaurantStateFromUserMessage(
            {},
            'Je veux reserver une table demain',
            restaurantProducts
        )

        expect(result.state.customer_flow.scheduled_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(result.state.customer_flow.scheduled_time).toBeNull()
        expect(result.state.awaiting_cf_field?.type).toBe('date_time')
        expect(result.directReply).toMatch(/heure/i)
        expect(result.directReply).not.toMatch(/quelle date et a quelle heure/i)
    })

    test('asks only for the phone number after the customer name is captured', () => {
        let state = updateRestaurantStateFromUserMessage(
            {},
            'Je veux reserver une table demain a 20h pour 4 personnes',
            restaurantProducts
        ).state

        state = updateRestaurantStateFromUserMessage(state, 'non', restaurantProducts).state

        const result = updateRestaurantStateFromUserMessage(state, 'koffi diby', restaurantProducts)

        expect(result.state.customer_flow.customer_name).toBe('koffi diby')
        expect(result.state.customer_flow.customer_phone).toBeNull()
        expect(result.state.awaiting_cf_field?.type).toBe('customer_info')
        expect(result.state.awaiting_cf_field?.label).toBe('numéro de téléphone')
        expect(result.directReply).toMatch(/t[eé]l[eé]phone/i)
        expect(result.directReply).not.toMatch(/nom complet et votre t[eé]l[eé]phone/i)
    })

    test('merges collected state into create_restaurant_checkout args', () => {
        const state = {
            stage: RESTAURANT_STAGE.READY,
            fulfillment_mode: 'delivery',
            cart_items: [{ product_name: 'Plat 01', quantity: 2, line_total_fcfa: 13000 }],
            customer_flow: {
                customer_name: 'Awa Konan',
                customer_phone: '+2250701020304',
                delivery_address: 'Cocody Riviera 2',
                payment_method: 'online',
                notes: 'Sans piment',
            },
        }

        const merged = mergeRestaurantStateIntoToolArgs('create_restaurant_checkout', {}, state)
        expect(merged.fulfillment_mode).toBe('delivery')
        expect(merged.customer_name).toBe('Awa Konan')
        expect(merged.customer_phone).toBe('+2250701020304')
        expect(merged.delivery_address).toBe('Cocody Riviera 2')
        expect(merged.payment_method).toBe('online')
        expect(merged.notes).toBe('Sans piment')
        expect(merged.items).toEqual([{ product_name: 'Plat 01', quantity: 2 }])
    })

    test('clears the state after a successful restaurant confirmation message', () => {
        const previousState = {
            stage: RESTAURANT_STAGE.READY,
            fulfillment_mode: 'dine_in',
            cart_items: [{ product_name: 'Plat 01', quantity: 1, line_total_fcfa: 6500 }],
        }

        const nextState = inferRestaurantStateFromAssistantMessage(
            'Reservation de table enregistree pour le client.',
            previousState
        )

        expect(hasRestaurantStateData(nextState)).toBe(false)
        expect(nextState.stage).toBe(RESTAURANT_STAGE.MENU_HOME)
    })

    test('guidance tells the model to call the tool immediately when state is READY', () => {
        const guidance = buildRestaurantStateGuidance({
            stage: RESTAURANT_STAGE.READY,
            fulfillment_mode: 'takeaway',
            cart_items: [{ product_name: 'Plat 01', quantity: 1, line_total_fcfa: 6500 }],
            customer_flow: {
                customer_name: 'Awa',
                customer_phone: '+2250701020304',
                payment_method: 'onsite',
            },
        })

        expect(guidance).toMatch(/create_restaurant_checkout maintenant/i)
        expect(guidance).toMatch(/Ne pose pas de question avant l'appel/i)
    })
})
