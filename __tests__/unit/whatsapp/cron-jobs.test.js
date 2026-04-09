const {
    cancelExpiredOrders,
    checkPendingPayments,
} = require('@/lib/whatsapp/cron/jobs')

function createSupabaseMock({ updatedOrder = { id: 'order_1' } } = {}) {
    const outboundInserts = []
    const orderUpdates = []

    const supabase = {
        from: jest.fn((table) => ({
            select: jest.fn(() => ({
                eq: jest.fn((column, value) => {
                    const chain = {
                        eq: jest.fn((secondColumn, secondValue) => {
                            if (table === 'orders' && column === 'status' && value === 'pending' && secondColumn === 'payment_method' && secondValue === 'online') {
                                return {
                                    lt: jest.fn(() => ({
                                        is: jest.fn(() => ([
                                            {
                                                id: 'order_1',
                                                agent_id: 'agent_1',
                                                customer_phone: '+22501020304',
                                                total_fcfa: 150,
                                                provider_payment_url: 'https://checkout.paystack.com/demo',
                                            }
                                        ]))
                                    })),
                                    select: undefined,
                                }
                            }

                            return chain
                        }),
                        lt: jest.fn(() => ({
                            is: jest.fn(async () => ({
                                data: [
                                    {
                                        id: 'order_1',
                                        agent_id: 'agent_1',
                                        customer_phone: '+22501020304',
                                                total_fcfa: 150,
                                                provider_payment_url: 'https://checkout.paystack.com/demo',
                                    }
                                ],
                                error: null
                            }))
                        })),
                    }
                    return chain
                })
            })),
            update: jest.fn((payload) => ({
                eq: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            maybeSingle: jest.fn(async () => {
                                orderUpdates.push(payload)
                                return { data: updatedOrder, error: updatedOrder ? null : { message: 'no row updated' } }
                            })
                        }))
                    })),
                    then: undefined,
                }))
            })),
            insert: jest.fn(async (payload) => {
                if (table === 'outbound_messages') {
                    outboundInserts.push(payload)
                }
                return { data: { id: `${table}_1` }, error: null }
            })
        }))
    }

    return { supabase, outboundInserts, orderUpdates }
}

describe('whatsapp cron jobs', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('uses provider payment url for reminders', async () => {
        const outboundInserts = []
        const supabase = {
            from: jest.fn((table) => ({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            lt: jest.fn(() => ({
                                is: jest.fn(async () => ({
                                    data: table === 'orders'
                                        ? [{
                                            id: 'order_1',
                                            agent_id: 'agent_1',
                                            customer_phone: '+22501020304',
                                            total_fcfa: 150,
                                            provider_payment_url: 'https://checkout.paystack.com/demo',
                                        }]
                                        : [],
                                    error: null
                                }))
                            }))
                        }))
                    }))
                })),
                update: jest.fn(() => ({
                    eq: jest.fn(async () => ({ error: null }))
                })),
                insert: jest.fn(async (payload) => {
                    if (table === 'outbound_messages') {
                        outboundInserts.push(payload)
                    }
                    return { data: { id: `${table}_1` }, error: null }
                })
            }))
        }

        await checkPendingPayments(supabase)

        expect(outboundInserts).toHaveLength(1)
        expect(outboundInserts[0].message_content).toContain('https://checkout.paystack.com/demo')
    })

    test('sends expiration message only when the order was actually cancelled', async () => {
        const { supabase, outboundInserts } = createSupabaseMock({ updatedOrder: null })

        await cancelExpiredOrders(supabase)

        expect(outboundInserts).toHaveLength(0)
    })
})
