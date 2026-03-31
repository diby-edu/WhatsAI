const mockNotify = jest.fn(async () => null)

jest.mock('../../../src/lib/notifications/notify', () => ({
    notify: (...args) => mockNotify(...args),
}))

function loadTool() {
    return require('../../../src/lib/whatsapp/ai/tools/tool-restaurant')
}

function createSupabase({
    agent,
    bookingRecord = null,
    bookingRpcData = { booking_id: 'booking-123' },
    orderRpcData = [{ order_id: 'order-123' }],
    rpcErrors = {},
    bookingUpdateError = null,
}) {
    const updates = []
    const rpcCalls = []

    const supabase = {
        from: jest.fn((table) => {
            if (table === 'agents') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: async () => ({ data: agent, error: null })
                        }))
                    }))
                }
            }

            if (table === 'bookings') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: async () => {
                                if (!bookingRecord) {
                                    return { data: null, error: { message: 'not found' } }
                                }
                                return { data: bookingRecord, error: null }
                            }
                        }))
                    })),
                    update: jest.fn((payload) => ({
                        eq: jest.fn(async () => {
                            updates.push({ table, payload })
                            if (bookingRecord) {
                                Object.assign(bookingRecord, payload)
                            }
                            return { error: bookingUpdateError }
                        })
                    }))
                }
            }

            throw new Error(`Unexpected table: ${table}`)
        }),
        rpc: jest.fn(async (name, params) => {
            rpcCalls.push({ name, params })

            if (name === 'create_restaurant_booking') {
                if (rpcErrors.booking) {
                    return { data: null, error: rpcErrors.booking }
                }
                return { data: bookingRpcData, error: null }
            }

            if (name === 'create_restaurant_order_with_items') {
                if (rpcErrors.order) {
                    return { data: null, error: rpcErrors.order }
                }
                return { data: orderRpcData, error: null }
            }

            throw new Error(`Unexpected rpc: ${name}`)
        })
    }

    return { supabase, updates, rpcCalls }
}

describe('tool-restaurant', () => {
    const restaurantProducts = [
        {
            id: 'prod-1',
            name: 'Thieb Poulet',
            description: 'Riz au poulet',
            category: 'plats',
            menu_section_slug: 'mains',
            product_type: 'service',
            service_subtype: 'restaurant',
            price_fcfa: 3500
        },
        {
            id: 'prod-2',
            name: 'Bissap',
            description: 'Boisson maison',
            category: 'boissons',
            menu_section_slug: 'drinks',
            product_type: 'service',
            service_subtype: 'restaurant',
            price_fcfa: 1000
        }
    ]

    beforeEach(() => {
        jest.resetModules()
        jest.clearAllMocks()
        process.env.CINETPAY_API_KEY = 'test-api-key'
        process.env.CINETPAY_SITE_ID = 'test-site-id'
        process.env.NEXT_PUBLIC_APP_URL = 'https://wazzapai.com'
        global.fetch = jest.fn()
    })

    test('creates a dine-in booking with online deposit payment link', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockResolvedValue({
            json: async () => ({
                code: '201',
                data: { payment_url: 'https://pay.example/bkg-123' }
            })
        })

        const bookingRecord = {
            id: 'booking-123',
            transaction_id: null,
            provider_payment_url: null
        }

        const { supabase, updates, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 30
            },
            bookingRecord
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'dine_in',
            items: [{ product_name: 'thieb poulet', quantity: 2 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            scheduled_date: '2026-04-05',
            scheduled_time: '20:00',
            party_size: 2,
            payment_method: 'online',
            notes: 'Table terrasse'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.record_type).toBe('booking')
        expect(result.total_fcfa).toBe(7000)
        expect(result.deposit_required).toBe(true)
        expect(result.deposit_amount_fcfa).toBe(2100)
        expect(result.payment_method).toBe('online')
        expect(result.payment_link).toBe('https://pay.example/bkg-123')
        expect(result.message).toMatch(/Acompte requis/i)

        expect(rpcCalls[0]).toEqual(expect.objectContaining({
            name: 'create_restaurant_booking',
            params: expect.objectContaining({
                p_fulfillment_mode: 'dine_in',
                p_payment_method: 'online',
                p_party_size: 2,
                p_deposit_required: true,
                p_deposit_percentage: 30,
                p_deposit_amount_fcfa: 2100,
            })
        }))
        expect(rpcCalls[0].params.p_items).toEqual([
            expect.objectContaining({
                product_id: 'prod-1',
                product_name: 'Thieb Poulet',
                quantity: 2,
                unit_price_fcfa: 3500,
                line_total_fcfa: 7000
            })
        ])

        expect(global.fetch).toHaveBeenCalledTimes(1)
        expect(updates).toHaveLength(1)
        expect(updates[0].payload.transaction_id).toMatch(/^BKG_booking-/)
        expect(updates[0].payload.provider_payment_url).toBe('https://pay.example/bkg-123')
        expect(mockNotify).toHaveBeenCalledWith('user-1', 'new_booking', expect.objectContaining({
            customerName: 'Awa Konan',
            serviceName: 'Restaurant Lagoon'
        }))
    })

    test('infers online payment for dine-in deposits when no explicit payment method is provided', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockResolvedValue({
            json: async () => ({
                code: '201',
                data: { payment_url: 'https://pay.example/bkg-auto' }
            })
        })

        const bookingRecord = {
            id: 'booking-123',
            transaction_id: null,
            provider_payment_url: null
        }

        const { supabase, updates, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                payment_mode: 'cinetpay',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 30
            },
            bookingRecord
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'dine_in',
            items: [{ product_name: 'thieb poulet', quantity: 2 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            scheduled_date: '2026-04-05',
            scheduled_time: '20:00',
            party_size: 2,
            notes: 'Table terrasse'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.payment_method).toBe('online')
        expect(result.payment_link).toBe('https://pay.example/bkg-auto')
        expect(rpcCalls[0].params.p_payment_method).toBe('online')
        expect(updates[0].payload.provider_payment_url).toBe('https://pay.example/bkg-auto')
    })

    test('overrides onsite to online for dine-in deposits on cinetpay agents', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockResolvedValue({
            json: async () => ({
                code: '201',
                data: { payment_url: 'https://pay.example/bkg-forced-online' }
            })
        })

        const bookingRecord = {
            id: 'booking-123',
            transaction_id: null,
            provider_payment_url: null
        }

        const { supabase, updates, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                payment_mode: 'cinetpay',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 50
            },
            bookingRecord
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'dine_in',
            items: [{ product_name: 'thieb poulet', quantity: 2 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            scheduled_date: '2026-04-05',
            scheduled_time: '20:00',
            party_size: 2,
            payment_method: 'onsite'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.payment_method).toBe('online')
        expect(result.payment_link).toBe('https://pay.example/bkg-forced-online')
        expect(rpcCalls[0].params.p_payment_method).toBe('online')
        expect(updates[0].payload.provider_payment_url).toBe('https://pay.example/bkg-forced-online')
    })

    test('reuses an existing booking deposit payment link without re-initiating CinetPay', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()

        const bookingRecord = {
            id: 'booking-123',
            transaction_id: 'BKG_existing_123',
            provider_payment_url: 'https://pay.example/existing'
        }

        const { supabase, updates } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 25
            },
            bookingRecord
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'dine_in',
            items: [{ product_name: 'bissap', quantity: 2 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            scheduled_date: '2026-04-05',
            scheduled_time: '20:00',
            party_size: 2,
            payment_method: 'online'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.deposit_required).toBe(true)
        expect(result.deposit_amount_fcfa).toBe(500)
        expect(result.payment_link).toBe('https://pay.example/existing')
        expect(global.fetch).not.toHaveBeenCalled()
        expect(updates).toHaveLength(0)
    })

    test('keeps the booking response deterministic when deposit link generation fails', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockRejectedValue(new Error('cinetpay maintenance'))

        const bookingRecord = {
            id: 'booking-123',
            transaction_id: null,
            provider_payment_url: null
        }

        const { supabase, updates } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 30
            },
            bookingRecord
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'dine_in',
            items: [{ product_name: 'thieb poulet', quantity: 2 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            scheduled_date: '2026-04-05',
            scheduled_time: '20:00',
            party_size: 2,
            payment_method: 'online'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.record_type).toBe('booking')
        expect(result.payment_link).toBeNull()
        expect(result.message).toMatch(/Acompte requis/i)
        expect(result.message).toMatch(/n'est pas encore confirmee/i)
        expect(result.message).toMatch(/lien de paiement est indisponible/i)
        expect(updates).toHaveLength(0)
    })

    test('creates takeaway orders with pending_pickup status and an online payment link', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 30
            },
            orderRpcData: [{ order_id: 'order-456' }]
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'takeaway',
            items: [
                { product_name: 'Thieb Poulet', quantity: 1 },
                { product_name: 'Bissap', quantity: 2 }
            ],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            payment_method: 'online'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.record_type).toBe('order')
        expect(result.fulfillment_mode).toBe('takeaway')
        expect(result.total_fcfa).toBe(5500)
        expect(result.payment_method).toBe('online')
        expect(result.payment_link).toBe('https://wazzapai.com/pay/order-456')

        expect(rpcCalls[0]).toEqual(expect.objectContaining({
            name: 'create_restaurant_order_with_items',
            params: expect.objectContaining({
                p_status: 'pending_pickup',
                p_payment_method: 'online',
                p_total_fcfa: 5500,
                p_fulfillment_mode: 'takeaway'
            })
        }))
        expect(mockNotify).toHaveBeenCalledWith('user-1', 'new_order', expect.objectContaining({
            orderNumber: 'order-456',
            customerName: 'Awa Konan',
            totalAmount: 5500
        }))
    })

    test('rejects delivery checkout when the delivery address is missing', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()

        const { supabase } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: false,
                restaurant_deposit_percentage: 0
            }
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'delivery',
            items: [{ product_name: 'Thieb Poulet', quantity: 1 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            payment_method: 'cod'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(false)
        expect(result.error).toMatch(/ADRESSE DE LIVRAISON MANQUANTE/i)
        expect(supabase.rpc).not.toHaveBeenCalled()
        expect(global.fetch).not.toHaveBeenCalled()
        expect(mockNotify).not.toHaveBeenCalled()
    })

    test('keeps onsite takeaway payments as cod and does not force an online link', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: false,
                restaurant_deposit_percentage: 0
            },
            orderRpcData: [{ order_id: 'order-789' }]
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'takeaway',
            items: [{ product_name: 'Thieb Poulet', quantity: 1 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            payment_method: 'onsite'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.payment_method).toBe('cod')
        expect(result.payment_link).toBeNull()
        expect(result.message).toMatch(/Paiement au retrait/i)
        expect(rpcCalls[0].params.p_payment_method).toBe('cod')
        expect(rpcCalls[0].params.p_status).toBe('pending_pickup')
    })
})
