const {
    sortRestaurantProducts,
    hasCartStateData,
    hasCheckoutStateData,
    formatDirectToolResponse,
    buildRecentCustomerProfile,
    resetTransactionalCycleMetadata,
} = require('@/lib/whatsapp/handlers/message-helpers')

describe('message-helpers', () => {
    describe('sortRestaurantProducts', () => {
        test('sorts by menu section order, then sort order, then name', () => {
            const products = [
                { name: 'Coca', menu_section_slug: 'drinks', menu_sort_order: 1 },
                { name: 'Pizza', menu_section_slug: 'mains', menu_sort_order: 2 },
                { name: 'Burger', menu_section_slug: 'mains', menu_sort_order: 1 },
                { name: 'Starter A', menu_section_slug: 'starters', menu_sort_order: 1 },
            ]
            const sorted = sortRestaurantProducts(products)
            expect(sorted.map(p => p.name)).toEqual(['Starter A', 'Burger', 'Pizza', 'Coca'])
        })

        test('places unknown sections last', () => {
            const products = [
                { name: 'Unknown', menu_section_slug: 'other' },
                { name: 'Starter A', menu_section_slug: 'starters' },
            ]
            const sorted = sortRestaurantProducts(products)
            expect(sorted.map(p => p.name)).toEqual(['Starter A', 'Unknown'])
        })

        test('does not mutate the input array', () => {
            const products = [{ name: 'B', menu_section_slug: 'drinks' }, { name: 'A', menu_section_slug: 'starters' }]
            const original = [...products]
            sortRestaurantProducts(products)
            expect(products).toEqual(original)
        })
    })

    describe('hasCartStateData', () => {
        test('returns false for empty state', () => {
            expect(hasCartStateData({})).toBe(false)
            expect(hasCartStateData(undefined)).toBe(false)
        })

        test('returns true when draft_item present', () => {
            expect(hasCartStateData({ draft_item: { name: 'x' } })).toBe(true)
        })

        test('returns true when cart_items non-empty', () => {
            expect(hasCartStateData({ cart_items: [{ id: 1 }] })).toBe(true)
        })

        test('returns false when cart_items empty', () => {
            expect(hasCartStateData({ cart_items: [] })).toBe(false)
        })
    })

    describe('hasCheckoutStateData', () => {
        test('returns false for idle/empty state', () => {
            expect(hasCheckoutStateData({})).toBe(false)
            expect(hasCheckoutStateData({ stage: 'idle' })).toBe(false)
        })

        test('returns true when stage is not idle', () => {
            expect(hasCheckoutStateData({ stage: 'collecting' })).toBeTruthy()
        })

        test('returns true when pending_fields non-empty', () => {
            expect(hasCheckoutStateData({ pending_fields: ['name'] })).toBe(true)
        })

        test('returns true when awaiting_field set', () => {
            expect(hasCheckoutStateData({ awaiting_field: 'phone' })).toBe(true)
        })

        test('returns true when collected has a non-empty value', () => {
            expect(hasCheckoutStateData({ collected: { name: 'John' } })).toBe(true)
        })

        test('returns false when collected values are all null/empty', () => {
            expect(hasCheckoutStateData({ collected: { name: null, phone: '' } })).toBe(false)
        })
    })

    describe('formatDirectToolResponse', () => {
        test('joins items and message', () => {
            expect(formatDirectToolResponse({ items: 'Item list', message: 'Thanks' })).toBe('Item list\n\nThanks')
        })

        test('falls back to error when no items/message', () => {
            expect(formatDirectToolResponse({ error: 'Something failed' })).toBe('Something failed')
        })

        test('returns empty string when nothing present', () => {
            expect(formatDirectToolResponse({})).toBe('')
        })
    })

    describe('buildRecentCustomerProfile', () => {
        test('returns null for empty orders', () => {
            expect(buildRecentCustomerProfile([])).toBeNull()
            expect(buildRecentCustomerProfile(undefined)).toBeNull()
        })

        test('picks the first non-null value per field across orders', () => {
            const orders = [
                { customer_name: null, customer_phone: '0700000000' },
                { customer_name: 'John', customer_email: 'john@example.com' },
            ]
            expect(buildRecentCustomerProfile(orders)).toEqual({
                customer_name: 'John',
                customer_phone: '0700000000',
                email: 'john@example.com',
                delivery_address: null,
                payment_method: null,
            })
        })
    })

    describe('resetTransactionalCycleMetadata', () => {
        test('clears transactional fields and stamps session_anchor_at', () => {
            const result = resetTransactionalCycleMetadata({ cart: { x: 1 }, other_field: 'kept' })
            expect(result.cart).toBeNull()
            expect(result.checkout).toBeNull()
            expect(result.booking).toBeNull()
            expect(result.restaurant).toBeNull()
            expect(result.external_context).toBeNull()
            expect(result.last_cycle_closed_at).toBeNull()
            expect(result.last_cycle_reason).toBeNull()
            expect(result.other_field).toBe('kept')
            expect(typeof result.session_anchor_at).toBe('string')
        })
    })
})
