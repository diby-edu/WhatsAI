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

function createSupabaseMock() {
    const messageInserts = []
    const conversationUpdates = []
    const orderUpdates = []

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
                    eq: jest.fn((column, value) => ({
                        single: jest.fn(async () => {
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
                        }),
                    })),
                })),
                update: jest.fn((payload) => ({
                    eq: jest.fn(async (_column, value) => {
                        if (table === 'orders') {
                            orderUpdates.push({ value, payload })
                        }
                        if (table === 'conversations') {
                            conversationUpdates.push({ value, payload })
                        }
                        return { error: null }
                    }),
                })),
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

    test('queues the payment confirmation before digital delivery with reassurance text', async () => {
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
                message: expect.stringContaining('Inutile de renvoyer un message'),
            })
        )

        expect(mockDeliverDigitalProducts).toHaveBeenCalledWith(
            'order_1',
            supabase,
            expect.objectContaining({
                announcePreparation: true,
                preparationMessage: 'Votre commande numerique est en preparation. Elle va vous etre envoyee ici sur WhatsApp dans quelques instants.',
            })
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
})
