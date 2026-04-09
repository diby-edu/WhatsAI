const { TextDecoder, TextEncoder } = require('util')
const { ReadableStream, WritableStream, TransformStream } = require('stream/web')
const { Blob, File } = require('buffer')
const { MessageChannel, MessagePort } = require('worker_threads')

global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder
global.ReadableStream = ReadableStream
global.WritableStream = WritableStream
global.TransformStream = TransformStream
global.Blob = Blob
global.File = File
global.MessageChannel = MessageChannel
global.MessagePort = MessagePort

const { Request, Response, Headers, FormData } = require('undici')

global.Request = Request
global.Response = Response
global.Headers = Headers
global.FormData = FormData

const { NextRequest } = require('next/server')

const mockCreateClient = jest.fn()
const mockVerifyPaystackTransaction = jest.fn()
const mockVerifyPaystackWebhookSignature = jest.fn()
const mockNotify = jest.fn()
const mockFinalizePaymentByTransaction = jest.fn()
const mockFinalizeHostedCheckoutTransaction = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
    createClient: (...args) => mockCreateClient(...args)
}))

jest.mock('@/lib/payments/paystack', () => ({
    verifyPaystackTransaction: (...args) => mockVerifyPaystackTransaction(...args),
    verifyPaystackWebhookSignature: (...args) => mockVerifyPaystackWebhookSignature(...args)
}))

jest.mock('@/lib/notifications/notification.service', () => ({
    notify: (...args) => mockNotify(...args)
}))

jest.mock('@/lib/payments/finalization', () => ({
    finalizePaymentByTransaction: (...args) => mockFinalizePaymentByTransaction(...args)
}))

jest.mock('@/lib/payments/hosted-checkout-finalization', () => ({
    finalizeHostedCheckoutTransaction: (...args) => mockFinalizeHostedCheckoutTransaction(...args),
    isOrderTransactionId: (value) => String(value || '').startsWith('ORD_') || String(value || '').startsWith('ORD-'),
    isBookingTransactionId: (value) => String(value || '').startsWith('BKG_') || String(value || '').startsWith('BKG-'),
}))

const { POST } = require('@/app/api/payments/paystack/webhook/route')

function makeWebhookRequest(body) {
    return new NextRequest(new Request('http://localhost/api/payments/paystack/webhook', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-paystack-signature': 'signed'
        },
        body: JSON.stringify(body)
    }))
}

function createSupabaseMock({
    order = null,
    booking = null,
    linkedConversation = null,
    updates = [],
    messageInserts = [],
    outboundInserts = []
}) {
    const makeSelectChain = (table) => ({
        eq: jest.fn((firstColumn, firstValue) => ({
            eq: jest.fn((secondColumn, secondValue) => ({
                single: jest.fn(async () => {
                    if (table === 'conversations' && firstColumn === 'agent_id' && secondColumn === 'contact_phone') {
                        if (linkedConversation && firstValue === linkedConversation.agent_id && secondValue === linkedConversation.contact_phone) {
                            return { data: linkedConversation, error: null }
                        }
                    }
                    return { data: null, error: { message: 'not found' } }
                })
            })),
            single: jest.fn(async () => {
                if (table === 'orders' && order && firstColumn === 'transaction_id' && firstValue === order.transaction_id) {
                    return { data: order, error: null }
                }
                if (table === 'bookings' && booking && firstColumn === 'transaction_id' && firstValue === booking.transaction_id) {
                    return { data: booking, error: null }
                }
                if (table === 'conversations' && linkedConversation && firstColumn === 'id' && firstValue === linkedConversation.id) {
                    return { data: linkedConversation, error: null }
                }
                if (table === 'agents' && order && firstColumn === 'id' && firstValue === order.agent_id) {
                    return { data: { user_id: 'user_1' }, error: null }
                }
                if (table === 'profiles' && firstColumn === 'id' && firstValue === 'user_1') {
                    return { data: { phone: '+2250102030405' }, error: null }
                }
                return { data: null, error: { message: 'not found' } }
            })
        })),
        maybeSingle: jest.fn(async () => ({ data: null, error: null }))
    })

    return {
        from: jest.fn((table) => ({
            select: jest.fn(() => {
                if (table === 'order_items') {
                    return {
                        eq: jest.fn(() => ({
                            data: [
                                { product_name: 'Plat du jour', quantity: 2 },
                                { product_name: 'Jus maison', quantity: 1 }
                            ],
                            error: null
                        }))
                    }
                }

                return makeSelectChain(table)
            }),
            update: jest.fn((payload) => ({
                eq: jest.fn(async (_column, value) => {
                    updates.push({ table, value, payload })
                    return { error: null }
                })
            })),
            insert: jest.fn(async (payload) => {
                if (table === 'messages') {
                    messageInserts.push({ table, payload })
                } else if (table === 'outbound_messages') {
                    outboundInserts.push({ table, payload })
                }

                return { data: { id: `${table}_1` }, error: null }
            })
        }))
    }
}

describe('POST /api/payments/paystack/webhook', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env.PAYSTACK_SECRET_KEY = 'paystack_secret'
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example'
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
        mockVerifyPaystackWebhookSignature.mockReturnValue(true)
        mockFinalizePaymentByTransaction.mockResolvedValue({ ok: true, state: 'completed' })
        mockFinalizeHostedCheckoutTransaction.mockResolvedValue({ ok: true, kind: 'order', state: 'finalized' })
    })

    test('finalizes hosted order references after charge.success', async () => {
        mockCreateClient.mockReturnValue(createSupabaseMock({}))
        mockVerifyPaystackTransaction.mockResolvedValue({
            success: true,
            status: 'ACCEPTED',
            transactionId: 'ORD_order_12_1234',
            amount: 6000
        })

        const response = await POST(makeWebhookRequest({
            event: 'charge.success',
            data: {
                reference: 'ORD_order_12_1234'
            }
        }))

        expect(response.status).toBe(200)
        expect(mockVerifyPaystackTransaction).toHaveBeenCalledWith('ORD_order_12_1234')
        expect(mockFinalizeHostedCheckoutTransaction).toHaveBeenCalledWith(
            expect.any(Object),
            'ORD_order_12_1234',
            expect.objectContaining({
                provider: 'paystack',
                amount: 6000,
                providerPayload: expect.anything(),
            })
        )
        expect(mockNotify).not.toHaveBeenCalled()
    })

    test('falls back to generic finalization for non order or booking references', async () => {
        mockCreateClient.mockReturnValue(createSupabaseMock({}))
        mockVerifyPaystackTransaction.mockResolvedValue({
            success: true,
            status: 'ACCEPTED',
            transactionId: 'PAY_123',
            amount: 3000
        })

        const payload = {
            event: 'charge.success',
            data: {
                reference: 'PAY_123'
            }
        }

        const response = await POST(makeWebhookRequest(payload))

        expect(response.status).toBe(200)
        expect(mockFinalizePaymentByTransaction).toHaveBeenCalledWith(
            expect.any(Object),
            'PAY_123',
            'ACCEPTED',
            expect.objectContaining({
                webhook: payload,
                verification: expect.anything()
            })
        )
    })
})
