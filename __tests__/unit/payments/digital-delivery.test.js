const mockQueueOutboundWhatsAppMessage = jest.fn()
const mockCloseCompletedCycle = jest.fn()

jest.mock('@/lib/whatsapp/outbound', () => ({
    queueOutboundWhatsAppMessage: (...args) => mockQueueOutboundWhatsAppMessage(...args)
}))

jest.mock('@/lib/whatsapp/services/conversation.service', () => ({
    ConversationService: {
        closeCompletedCycle: (...args) => mockCloseCompletedCycle(...args),
    }
}))

const { deliverDigitalProducts } = require('@/lib/payments/digital-delivery')

function createSupabaseMock(options = {}) {
    const orderUpdates = []
    const productUpdates = []
    const {
        orderItems = [{ product_name: 'Guide PDF — Trouver un emploi', quantity: 1 }],
        products = [{
            id: 'product_1',
            name: 'Guide PDF — Trouver un emploi',
            product_type: 'digital',
            digital_content: 'https://example.com/file.pdf',
            license_keys: null,
        }],
    } = options

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
                        ? orderItems
                        : table === 'products'
                            ? products
                            : null,
                }))
            })),
            update: jest.fn((payload) => ({
                eq: jest.fn(async () => {
                    if (table === 'orders') {
                        orderUpdates.push(payload)
                    }
                    if (table === 'products') {
                        productUpdates.push(payload)
                    }
                    return { error: null }
                })
            }))
        }))
    }

    return { supabase, orderUpdates, productUpdates }
}

describe('deliverDigitalProducts', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockQueueOutboundWhatsAppMessage.mockResolvedValue({ queued: true })
        mockCloseCompletedCycle.mockResolvedValue(undefined)
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
        expect(mockCloseCompletedCycle).toHaveBeenCalledWith(
            supabase,
            'conv_1',
            'digital_delivery_completed'
        )
    })

    test('can queue a preparation message before the digital file', async () => {
        const { supabase } = createSupabaseMock()

        await deliverDigitalProducts('order_1', supabase, {
            announcePreparation: true,
            preparationMessage: 'Votre commande numerique est en preparation. Elle va vous etre envoyee ici sur WhatsApp dans quelques instants.',
        })

        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenNthCalledWith(
            1,
            supabase,
            expect.objectContaining({
                agentId: 'agent_1',
                to: '123456789012345@lid',
                message: 'Votre commande numerique est en preparation. Elle va vous etre envoyee ici sur WhatsApp dans quelques instants.',
            })
        )

        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenNthCalledWith(
            2,
            supabase,
            expect.objectContaining({
                agentId: 'agent_1',
                to: '123456789012345@lid',
                message: expect.stringContaining('Votre produit numerique est disponible'),
            })
        )
    })

    test('delivers one activation key per requested license quantity', async () => {
        const { supabase, productUpdates } = createSupabaseMock({
            orderItems: [{ product_name: 'Logiciel Antivirus', quantity: 2 }],
            products: [{
                id: 'product_1',
                name: 'Logiciel Antivirus',
                product_type: 'digital',
                digital_content: null,
                license_keys: [
                    { key: 'aaa-aaa-aaa-aaa', used: false, order_id: null },
                    { key: 'bbb-bbb-bbb-bbb', used: false, order_id: null },
                    { key: 'ccc-ccc-ccc-ccc', used: false, order_id: null },
                ],
            }],
        })

        await deliverDigitalProducts('order_1', supabase, {
            announcePreparation: true,
        })

        expect(productUpdates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                license_keys: expect.arrayContaining([
                    expect.objectContaining({ key: 'aaa-aaa-aaa-aaa', used: true, order_id: 'order_1' }),
                    expect.objectContaining({ key: 'bbb-bbb-bbb-bbb', used: true, order_id: 'order_1' }),
                ]),
            }),
        ]))

        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenNthCalledWith(
            2,
            supabase,
            expect.objectContaining({
                agentId: 'agent_1',
                to: '123456789012345@lid',
                message: expect.stringContaining("Voici vos 2 cles d'activation"),
            })
        )
        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenNthCalledWith(
            2,
            supabase,
            expect.objectContaining({
                message: expect.stringContaining('1. aaa-aaa-aaa-aaa'),
            })
        )
        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenNthCalledWith(
            2,
            supabase,
            expect.objectContaining({
                message: expect.stringContaining('2. bbb-bbb-bbb-bbb'),
            })
        )
    })

    test('does not label repeated digital links as activation keys', async () => {
        const { supabase } = createSupabaseMock({
            orderItems: [{ product_name: "Pack Fonds d'écran", quantity: 2 }],
            products: [{
                id: 'product_1',
                name: "Pack Fonds d'écran",
                product_type: 'digital',
                digital_content: 'https://www.test2.com',
                license_keys: null,
            }],
        })

        await deliverDigitalProducts('order_1', supabase)

        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenCalledWith(
            supabase,
            expect.objectContaining({
                agentId: 'agent_1',
                to: '123456789012345@lid',
                message: expect.not.stringContaining("Voici vos 2 cles d'activation"),
            })
        )
        expect(mockQueueOutboundWhatsAppMessage).toHaveBeenCalledWith(
            supabase,
            expect.objectContaining({
                message: expect.stringContaining('https://www.test2.com'),
            })
        )
    })
})
