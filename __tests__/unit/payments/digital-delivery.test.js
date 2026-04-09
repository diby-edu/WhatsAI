const mockQueueOutboundWhatsAppMessage = jest.fn()

jest.mock('@/lib/whatsapp/outbound', () => ({
    queueOutboundWhatsAppMessage: (...args) => mockQueueOutboundWhatsAppMessage(...args)
}))

const { deliverDigitalProducts } = require('@/lib/payments/digital-delivery')

function createSupabaseMock() {
    const orderUpdates = []

    const supabase = {
        from: jest.fn((table) => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(async () => {
                        if (table === 'orders') {
                            return {
                                data: {
                                    id: 'order_1',
                                    agent_id: 'agent_1',
                                    customer_phone: '+22501020304',
                                    conversation_id: 'conv_1',
                                },
                                error: null
                            }
                        }

                        if (table === 'conversations') {
                            return {
                                data: {
                                    contact_jid: '123456789012345@lid',
                                    contact_phone: '123456789012345@lid',
                                },
                                error: null
                            }
                        }

                        return { data: null, error: null }
                    }),
                    then: undefined,
                    data: table === 'order_items'
                        ? [{ product_name: 'Guide PDF — Trouver un emploi' }]
                        : table === 'products'
                            ? [{
                                id: 'product_1',
                                name: 'Guide PDF — Trouver un emploi',
                                product_type: 'digital',
                                digital_content: 'https://example.com/file.pdf',
                                license_keys: null,
                            }]
                            : null,
                }))
            })),
            update: jest.fn((payload) => ({
                eq: jest.fn(async () => {
                    if (table === 'orders') {
                        orderUpdates.push(payload)
                    }
                    return { error: null }
                })
            }))
        }))
    }

    return { supabase, orderUpdates }
}

describe('deliverDigitalProducts', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockQueueOutboundWhatsAppMessage.mockResolvedValue({ queued: true })
    })

    test('marks digital orders as completed after queueing delivery', async () => {
        const { supabase, orderUpdates } = createSupabaseMock()

        await deliverDigitalProducts('order_1', supabase)

        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenCalledWith(
            supabase,
            expect.objectContaining({
                agentId: 'agent_1',
                to: '123456789012345@lid',
            })
        )
        expect(orderUpdates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                status: 'completed',
                updated_at: expect.any(String),
            })
        ]))
    })
})
