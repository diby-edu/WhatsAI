const mockQueueOutboundWhatsAppMessage = jest.fn()
const mockDeliverDigitalProducts = jest.fn()
const mockNotify = jest.fn()

jest.mock('@/lib/whatsapp/outbound', () => ({
    queueOutboundWhatsAppMessage: (...args) => mockQueueOutboundWhatsAppMessage(...args),
}))

jest.mock('@/lib/payments/digital-delivery', () => ({
    deliverDigitalProducts: (...args) => mockDeliverDigitalProducts(...args),
}))

jest.mock('@/lib/notifications/notification.service', () => ({
    notify: (...args) => mockNotify(...args),
}))

const { finalizeHostedOrderPayment } = require('@/lib/payments/hosted-checkout-finalization')

function createSupabaseMock(options = {}) {
    const messageInserts = []
    const conversationUpdates = []
    const orderUpdates = []
    const { simulateConcurrentOrderFinalization = false } = options

    const order = {
        id: 'order_1',
        transaction_id: 'ORD_order_1',
        status: 'pending',
        total_fcfa: 150,
        agent_id: 'agent_1',
        customer_phone: '+2250700000000',
        customer_name: 'Koffi',
        conversation_id: 'conv_1',
        deposit_required: false,
        deposit_status: null,
        fulfillment_mode: null,
    }

    const conversation = {
        id: 'conv_1',
        contact_phone: '123456789012345@lid',
        contact_jid: '123456789012345@lid',
    }

    return {
        messageInserts,
        conversationUpdates,
        orderUpdates,
        supabase: {
            from: jest.fn((table) => ({
                select: jest.fn(() => ({
                    eq: jest.fn((column, value) => {
                        const resolveRow = async () => {
                            if (table === 'orders' && column === 'transaction_id' && value === 'ORD_order_1') {
                                return { data: order, error: null }
                            }
                            if (table === 'conversations' && column === 'id' && value === 'conv_1') {
                                return { data: conversation, error: null }
                            }
                            if (table === 'agents' && column === 'id' && value === 'agent_1') {
                                return { data: { user_id: 'user_1' }, error: null }
                            }
                            if (table === 'profiles' && column === 'id' && value === 'user_1') {
                                return { data: { phone: null }, error: null }
                            }
                            return { data: null, error: { message: 'not found' } }
                        }
                        return {
                            single: jest.fn(resolveRow),
                            // maybeSingle : pas d'erreur quand la ligne n'existe pas
                            maybeSingle: jest.fn(async () => {
                                const result = await resolveRow()
                                return result.error ? { data: null, error: null } : result
                            }),
                        }
                    }),
                    like: jest.fn(() => ({
                        limit: jest.fn(async () => ({ data: [], error: null })),
                    })),
                })),
                update: jest.fn((payload) => {
                    const eqState = []
                    const chain = {
                        eq: jest.fn((column, value) => {
                            eqState.push({ column, value })
                            return chain
                        }),
                        select: jest.fn(async () => {
                            if (table === 'orders') {
                                orderUpdates.push({ payload, filters: [...eqState] })
                                if (simulateConcurrentOrderFinalization) {
                                    order.status = 'completed'
                                    return { data: [], error: null }
                                }

                                order.status = payload.status || order.status
                                return { data: [{ id: order.id, status: order.status }], error: null }
                            }

                            if (table === 'bookings') {
                                return { data: [{ id: 'booking_1', status: 'confirmed', deposit_status: 'paid' }], error: null }
                            }

                            return { data: [], error: null }
                        }),
                    }

                    if (table === 'conversations') {
                        chain.eq = jest.fn((column, value) => {
                            eqState.push({ column, value })
                            conversationUpdates.push({ value, payload, filters: [...eqState, { column, value }] })
                            return Promise.resolve({ error: null })
                        })
                    }

                    return chain
                }),
                insert: jest.fn(async (payload) => {
                    if (table === 'messages') {
                        messageInserts.push(payload)
                    }
                    return { data: { id: `${table}_1` }, error: null }
                }),
            })),
        },
    }
}

describe('hosted-checkout-finalization', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockQueueOutboundWhatsAppMessage.mockResolvedValue({ queued: true })
        mockDeliverDigitalProducts.mockResolvedValue(undefined)
    })

    test('queues the payment confirmation with the embedded preparation notice before digital delivery', async () => {
        const { supabase, messageInserts } = createSupabaseMock()

        await finalizeHostedOrderPayment(supabase, 'ORD_order_1', {
            provider: 'paystack',
            amount: 150,
        })

        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenCalledWith(
            supabase,
            expect.objectContaining({
                agentId: 'agent_1',
                to: '123456789012345@lid',
                message: expect.stringContaining('Votre produit numerique va vous etre envoye'),
            })
        )

        expect(mockDeliverDigitalProducts).toHaveBeenCalledWith(
            'order_1',
            supabase
        )

        expect(messageInserts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                conversation_id: 'conv_1',
                agent_id: 'agent_1',
                role: 'assistant',
                status: 'sent',
                content: expect.stringContaining('Paiement recu'),
            }),
        ]))
    })

    test('returns already_finalized without notifying twice when another finalizer wins the race', async () => {
        const { supabase, messageInserts, orderUpdates } = createSupabaseMock({
            simulateConcurrentOrderFinalization: true,
        })

        const result = await finalizeHostedOrderPayment(supabase, 'ORD_order_1', {
            provider: 'paystack',
            amount: 150,
        })

        expect(result.state).toBe('already_finalized')
        expect(orderUpdates).toHaveLength(1)
        expect(mockQueueOutboundWhatsAppMessage).not.toHaveBeenCalled()
        expect(mockDeliverDigitalProducts).not.toHaveBeenCalled()
        expect(mockNotify).not.toHaveBeenCalled()
        expect(messageInserts).toHaveLength(0)
    })
})
