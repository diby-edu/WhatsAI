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
    orderRecord = null,
    orderRpcData = [{ order_id: 'order-123' }],
    rpcErrors = {},
    bookingUpdateError = null,
    orderUpdateError = null,
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

            if (table === 'orders') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: async () => {
                                if (!orderRecord) {
                                    return { data: null, error: { message: 'not found' } }
                                }
                                return { data: orderRecord, error: null }
                            }
                        }))
                    })),
                    update: jest.fn((payload) => ({
                        eq: jest.fn(async () => {
                            updates.push({ table, payload })
                            if (orderRecord) {
                                Object.assign(orderRecord, payload)
                            }
                            return { error: orderUpdateError }
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
        expect(updates).toHaveLength(2)
        expect(updates[0].payload.payment_provider_version).toBe('v1')
        expect(updates[1].payload.transaction_id).toMatch(/^BKG-booking-/)
        expect(updates[1].payload.provider_payment_url).toBe('https://pay.example/bkg-123')
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
        expect(updates).toHaveLength(2)
        expect(updates[0].payload.payment_provider_version).toBe('v1')
        expect(updates[1].payload.provider_payment_url).toBe('https://pay.example/bkg-auto')
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
        expect(updates).toHaveLength(2)
        expect(updates[0].payload.payment_provider_version).toBe('v1')
        expect(updates[1].payload.provider_payment_url).toBe('https://pay.example/bkg-forced-online')
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
        expect(updates).toHaveLength(1)
        expect(updates[0].payload.payment_provider_version).toBe('v1')
    })

    test('creates a dine-in booking without deposit and keeps onsite payment', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                payment_mode: 'cinetpay',
                restaurant_deposit_enabled: false,
                restaurant_deposit_percentage: 0
            }
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'dine_in',
            items: [{ product_name: 'thieb poulet', quantity: 1 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            scheduled_date: '2026-04-05',
            scheduled_time: '20:00',
            party_size: 2
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.deposit_required).toBe(false)
        expect(result.deposit_amount_fcfa).toBe(0)
        expect(result.payment_method).toBe('onsite')
        expect(result.payment_link).toBeNull()
        expect(result.message).not.toMatch(/Acompte requis/i)
        expect(rpcCalls[0].params.p_payment_method).toBe('onsite')
        expect(rpcCalls[0].params.p_deposit_required).toBe(false)
        expect(rpcCalls[0].params.p_deposit_amount_fcfa).toBe(0)
        expect(global.fetch).not.toHaveBeenCalled()
    })

    test('creates a dine-in booking with a fixed deposit amount', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockResolvedValue({
            json: async () => ({
                code: '201',
                data: { payment_url: 'https://pay.example/bkg-fixed-123' }
            })
        })

        const bookingRecord = {
            id: 'booking-123',
            transaction_id: null,
            provider_payment_url: null
        }

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                payment_mode: 'cinetpay',
                restaurant_deposit_enabled: true,
                restaurant_deposit_mode: 'fixed',
                restaurant_deposit_percentage: 30,
                restaurant_deposit_fixed_amount_fcfa: 5000
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
        expect(result.deposit_required).toBe(true)
        expect(result.deposit_amount_fcfa).toBe(5000)
        expect(result.payment_link).toBe('https://pay.example/bkg-fixed-123')
        expect(result.message).toMatch(/montant fixe/i)
        expect(result.message).not.toMatch(/\(\d+%\)/)
        expect(rpcCalls[0].params.p_deposit_required).toBe(true)
        expect(rpcCalls[0].params.p_deposit_percentage).toBe(0)
        expect(rpcCalls[0].params.p_deposit_amount_fcfa).toBe(5000)
    })

    test('caps a fixed dine-in deposit to the booking total when the configured amount is higher', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockResolvedValue({
            json: async () => ({
                code: '201',
                data: { payment_url: 'https://pay.example/bkg-fixed-capped' }
            })
        })

        const bookingRecord = {
            id: 'booking-123',
            transaction_id: null,
            provider_payment_url: null
        }

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                payment_mode: 'cinetpay',
                restaurant_deposit_enabled: true,
                restaurant_deposit_mode: 'fixed',
                restaurant_deposit_fixed_amount_fcfa: 10000
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
        expect(result.total_fcfa).toBe(2000)
        expect(result.deposit_required).toBe(true)
        expect(result.deposit_amount_fcfa).toBe(2000)
        expect(result.message).toMatch(/2 000 FCFA|2 000 FCFA/)
        expect(rpcCalls[0].params.p_deposit_percentage).toBe(0)
        expect(rpcCalls[0].params.p_deposit_amount_fcfa).toBe(2000)
    })

    test('sends an inferred CinetPay v2 payment_method for CI test phones', async () => {
        process.env.CINETPAY_V2_ENABLED = 'true'
        process.env.CINETPAY_V2_BASE_URL = 'https://api.cinetpay.net'
        process.env.CINETPAY_V2_ACCOUNT_KEY = 'sk_test_123'
        process.env.CINETPAY_V2_ACCOUNT_PASSWORD = 'secret_123'
        process.env.CINETPAY_V2_TEST_AGENT_IDS = 'agent-v2'

        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'OK',
                    access_token: 'token-v2',
                    expires_in: 86400
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'OK',
                    payment_url: 'https://pay.example/v2-bkg-123',
                    transaction_id: 'cp-tx-123',
                    notify_token: 'notify-v2-123'
                })
            })

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
                payment_mode: 'cinetpay',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 50
            },
            bookingRecord
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'dine_in',
            items: [{ product_name: 'thieb poulet', quantity: 2 }],
            customer_name: 'Koffi Test',
            customer_phone: '+2250707070700',
            scheduled_date: '2026-04-05',
            scheduled_time: '21:00',
            party_size: 3
        }, 'agent-v2', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)
        const paymentCall = global.fetch.mock.calls[1]
        const paymentPayload = JSON.parse(paymentCall[1].body)

        expect(result.success).toBe(true)
        expect(result.payment_method).toBe('online')
        expect(result.payment_link).toBe('https://pay.example/v2-bkg-123')
        expect(paymentPayload.payment_method).toBe('OM')
        expect(updates).toHaveLength(2)
        expect(updates[0].payload.payment_provider_version).toBe('v2')
        expect(updates[1].payload.payment_provider_version).toBe('v2')
        expect(updates[1].payload.provider_payment_url).toBe('https://pay.example/v2-bkg-123')
        expect(updates[1].payload.provider_transaction_id).toBe('cp-tx-123')
        expect(updates[1].payload.provider_notify_token).toBe('notify-v2-123')
    })

    test('retries CinetPay v2 with alternate CI payment method variants after invalid params', async () => {
        process.env.CINETPAY_V2_ENABLED = 'true'
        process.env.CINETPAY_V2_BASE_URL = 'https://api.cinetpay.net'
        process.env.CINETPAY_V2_ACCOUNT_KEY = 'sk_test_123'
        process.env.CINETPAY_V2_ACCOUNT_PASSWORD = 'secret_123'
        process.env.CINETPAY_V2_TEST_AGENT_IDS = 'agent-v2'

        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    status: 'OK',
                    access_token: 'token-v2',
                    expires_in: 86400
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    code: 200,
                    status: 'OK',
                    details: {
                        code: 1004,
                        status: 'INVALID_PARAMS',
                        message: 'Params you provides are invalid'
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({
                    status: 'OK',
                    payment_url: 'https://pay.example/v2-bkg-retry',
                    transaction_id: 'cp-tx-retry',
                    notify_token: 'notify-v2-retry'
                })
            })

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
                payment_mode: 'cinetpay',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 50
            },
            bookingRecord
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'dine_in',
            items: [{ product_name: 'thieb poulet', quantity: 2 }],
            customer_name: 'Koffi Test',
            customer_phone: '+2250707070700',
            scheduled_date: '2026-04-05',
            scheduled_time: '21:00',
            party_size: 3
        }, 'agent-v2', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)
        const firstPaymentPayload = JSON.parse(global.fetch.mock.calls[1][1].body)
        const secondPaymentPayload = JSON.parse(global.fetch.mock.calls[2][1].body)

        expect(result.success).toBe(true)
        expect(result.payment_link).toBe('https://pay.example/v2-bkg-retry')
        expect(firstPaymentPayload.payment_method).toBe('OM')
        expect(secondPaymentPayload.payment_method).toBe('OM_CI')
        expect(secondPaymentPayload.merchant_transaction_id).toMatch(/-r2$/)
        expect(updates).toHaveLength(2)
        expect(updates[1].payload.payment_provider_version).toBe('v2')
        expect(updates[1].payload.provider_payment_url).toBe('https://pay.example/v2-bkg-retry')
        expect(updates[1].payload.provider_transaction_id).toBe('cp-tx-retry')
        expect(updates[1].payload.provider_notify_token).toBe('notify-v2-retry')
    })

    test('creates takeaway orders with pending_pickup status and an online payment link', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockResolvedValue({
            json: async () => ({
                code: '201',
                data: {
                    payment_url: 'https://pay.example/order-456'
                }
            })
        })

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: true,
                restaurant_deposit_percentage: 30
            },
            orderRecord: {
                id: 'order-456',
                transaction_id: null,
                provider_payment_url: null,
                payment_provider_version: null
            },
            orderRpcData: [{ order_id: 'order-456' }]
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'takeaway',
            items: [
                { product_name: 'Thieb Poulet', quantity: 1 },
                { product_name: 'Bissap', quantity: 2 }
            ],
            scheduled_date: '2026-04-01',
            scheduled_time: '23:00',
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
        expect(result.payment_link).toBe('https://pay.example/order-456')
        expect(result.message).toMatch(/Retrait prevu le/)

        expect(rpcCalls[0]).toEqual(expect.objectContaining({
            name: 'create_restaurant_order_with_items',
            params: expect.objectContaining({
                p_status: 'pending_pickup',
                p_payment_method: 'online',
                p_total_fcfa: 5500,
                p_fulfillment_mode: 'takeaway',
                p_pickup_at: expect.any(String)
            })
        }))
        expect(mockNotify).toHaveBeenCalledWith('user-1', 'new_order', expect.objectContaining({
            orderNumber: 'order-456',
            customerName: 'Awa Konan',
            totalAmount: 5500
        }))
    })

    test('creates takeaway orders with a fixed deposit amount', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockResolvedValue({
            json: async () => ({
                code: '201',
                data: {
                    payment_url: 'https://pay.example/order-fixed-456'
                }
            })
        })

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                payment_mode: 'cinetpay',
                restaurant_deposit_enabled: true,
                restaurant_deposit_mode: 'fixed',
                restaurant_deposit_fixed_amount_fcfa: 2500
            },
            orderRecord: {
                id: 'order-456',
                transaction_id: null,
                provider_payment_url: null,
                payment_provider_version: null
            },
            orderRpcData: [{ order_id: 'order-456' }]
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'takeaway',
            items: [
                { product_name: 'Thieb Poulet', quantity: 1 },
                { product_name: 'Bissap', quantity: 2 }
            ],
            scheduled_date: '2026-04-01',
            scheduled_time: '23:00',
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            payment_method: 'online'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.deposit_required).toBe(true)
        expect(result.deposit_amount_fcfa).toBe(2500)
        expect(result.payment_link).toBe('https://pay.example/order-fixed-456')
        expect(result.message).toMatch(/montant fixe/i)
        expect(rpcCalls[0].params.p_deposit_required).toBe(true)
        expect(rpcCalls[0].params.p_deposit_percentage).toBe(0)
        expect(rpcCalls[0].params.p_deposit_amount_fcfa).toBe(2500)
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

    test('creates delivery orders paid on delivery without deposit', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: false,
                restaurant_deposit_percentage: 0
            },
            orderRpcData: [{ order_id: 'order-delivery-cod' }]
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'delivery',
            items: [{ product_name: 'Thieb Poulet', quantity: 1 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            delivery_address: 'Cocody Riviera 2',
            payment_method: 'a la livraison'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.payment_method).toBe('cod')
        expect(result.payment_link).toBeNull()
        expect(result.deposit_required).toBe(false)
        expect(result.message).toMatch(/Paiement a la livraison/i)
        expect(rpcCalls[0].params.p_payment_method).toBe('cod')
        expect(rpcCalls[0].params.p_status).toBe('pending_delivery')
        expect(global.fetch).not.toHaveBeenCalled()
    })

    test('creates delivery orders with online payment when no deposit is required', async () => {
        const { handleCreateRestaurantCheckout } = loadTool()
        global.fetch.mockResolvedValue({
            json: async () => ({
                code: '201',
                data: {
                    payment_url: 'https://pay.example/order-delivery-online'
                }
            })
        })

        const { supabase, rpcCalls } = createSupabase({
            agent: {
                user_id: 'user-1',
                name: 'Restaurant Lagoon',
                escalation_phone: '+2250102030405',
                restaurant_deposit_enabled: false,
                restaurant_deposit_percentage: 0
            },
            orderRecord: {
                id: 'order-delivery-online',
                transaction_id: null,
                provider_payment_url: null,
                payment_provider_version: null
            },
            orderRpcData: [{ order_id: 'order-delivery-online' }]
        })

        const rawResult = await handleCreateRestaurantCheckout({
            fulfillment_mode: 'delivery',
            items: [{ product_name: 'Thieb Poulet', quantity: 1 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            delivery_address: 'Cocody Riviera 2',
            payment_method: 'online'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.payment_method).toBe('online')
        expect(result.payment_link).toBe('https://pay.example/order-delivery-online')
        expect(result.deposit_required).toBe(false)
        expect(rpcCalls[0].params.p_payment_method).toBe('online')
        expect(rpcCalls[0].params.p_status).toBe('pending')
    })

    test('rejects delivery-worded payment choices on takeaway orders', async () => {
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
            fulfillment_mode: 'takeaway',
            items: [{ product_name: 'Thieb Poulet', quantity: 1 }],
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            payment_method: 'a la livraison'
        }, 'agent-1', restaurantProducts, 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(false)
        expect(result.error).toMatch(/commande a emporter/i)
        expect(result.error).toMatch(/en ligne.*au retrait/i)
        expect(supabase.rpc).not.toHaveBeenCalled()
    })
})
