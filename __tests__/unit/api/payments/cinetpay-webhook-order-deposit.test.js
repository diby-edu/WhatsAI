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
const mockCheckPaymentStatus = jest.fn()
const mockVerifyWebhookSignature = jest.fn()
const mockNotify = jest.fn()
const mockFinalizePaymentByTransaction = jest.fn()
const mockDeliverDigitalProducts = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
    createClient: (...args) => mockCreateClient(...args)
}))

jest.mock('@/lib/payments/cinetpay', () => ({
    checkPaymentStatus: (...args) => mockCheckPaymentStatus(...args),
    verifyWebhookSignature: (...args) => mockVerifyWebhookSignature(...args)
}))

jest.mock('@/lib/notifications/notification.service', () => ({
    notify: (...args) => mockNotify(...args)
}))

jest.mock('@/lib/payments/finalization', () => ({
    finalizePaymentByTransaction: (...args) => mockFinalizePaymentByTransaction(...args)
}))

jest.mock('@/lib/payments/digital-delivery', () => ({
    deliverDigitalProducts: (...args) => mockDeliverDigitalProducts(...args)
}))

const { POST } = require('@/app/api/payments/cinetpay/webhook/route')

function makeWebhookRequest(body) {
    return new NextRequest(new Request('http://localhost/api/payments/cinetpay/webhook', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-token': 'signed'
        },
        body: JSON.stringify(body)
    }))
}

function createSupabaseMock({ order, updates = [], messageInserts = [], outboundInserts = [] }) {
    const conversationRow = {
        id: order.conversation_id,
        agent_id: order.agent_id,
        metadata: {
            restaurant: {
                stage: 'RESTAURANT_DEPOSIT'
            }
        }
    }

    const makeInsertChain = (table, payload) => ({
        select: jest.fn(() => ({
            single: jest.fn(async () => {
                if (table === 'messages') {
                    messageInserts.push({ table, payload })
                } else if (table === 'outbound_messages') {
                    outboundInserts.push({ table, payload })
                }
                return { data: { id: `${table}_1` }, error: null }
            })
        }))
    })

    return {
        from: jest.fn((table) => ({
            select: jest.fn(() => ({
                eq: jest.fn((firstColumn, firstValue) => ({
                    eq: jest.fn((secondColumn, secondValue) => ({
                        single: jest.fn(async () => {
                            if (table === 'conversations' && firstColumn === 'agent_id' && secondColumn === 'contact_phone') {
                                if (firstValue === order.agent_id && secondValue === order.customer_phone) {
                                    return { data: conversationRow, error: null }
                                }
                            }
                            return { data: null, error: { message: 'not found' } }
                        })
                    })),
                    single: jest.fn(async () => {
                        if (table === 'orders' && firstColumn === 'transaction_id' && firstValue === order.transaction_id) {
                            return { data: order, error: null }
                        }
                        if (table === 'conversations' && firstColumn === 'id' && firstValue === order.conversation_id) {
                            return { data: conversationRow, error: null }
                        }
                        if (table === 'agents' && firstColumn === 'id' && firstValue === order.agent_id) {
                            return { data: { user_id: 'user_1' }, error: null }
                        }
                        if (table === 'profiles' && firstColumn === 'id' && firstValue === 'user_1') {
                            return { data: { phone: '+2250102030405' }, error: null }
                        }
                        return { data: null, error: { message: 'not found' } }
                    }),
                    then: undefined
                })),
                order: jest.fn(() => ({
                    limit: jest.fn(async () => ({ data: [], error: null }))
                }))
            })),
            update: jest.fn((payload) => ({
                eq: jest.fn(async (_column, value) => {
                    updates.push({ table, value, payload })
                    return { error: null }
                })
            })),
            insert: jest.fn((payload) => {
                if (table === 'outbound_messages' && !payload?.select) {
                    outboundInserts.push({ table, payload })
                }
                return makeInsertChain(table, payload)
            })
        }))
    }
}

describe('POST /api/payments/cinetpay/webhook for ORD_* restaurant deposits', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env.CINETPAY_SECRET_KEY = 'secret'
        process.env.CINETPAY_SITE_ID = 'site_123'
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example'
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
        mockVerifyWebhookSignature.mockReturnValue(true)
        mockFinalizePaymentByTransaction.mockResolvedValue({ ok: true, state: 'not_found' })
        mockDeliverDigitalProducts.mockResolvedValue(undefined)
    })

    test('marks a restaurant order deposit as paid and advances the order to pending_pickup', async () => {
        const order = {
            id: 'order_123',
            transaction_id: 'ORD_order_12_1234',
            status: 'pending_pickup',
            total_fcfa: 20000,
            deposit_required: true,
            deposit_status: 'pending',
            deposit_amount_fcfa: 6000,
            fulfillment_mode: 'takeaway',
            conversation_id: 'conv_1',
            agent_id: 'agent_1',
            customer_phone: '+2250701020304',
            customer_name: 'Awa Konan'
        }
        const updates = []
        const messageInserts = []
        const outboundInserts = []

        mockCreateClient.mockReturnValue(createSupabaseMock({
            order,
            updates,
            messageInserts,
            outboundInserts
        }))
        mockCheckPaymentStatus.mockResolvedValue({ status: 'ACCEPTED', amount: 6000 })

        const response = await POST(makeWebhookRequest({
            cpm_site_id: 'site_123',
            cpm_trans_id: 'ORD_order_12_1234',
            cpm_trans_date: '20260329120000',
            cpm_amount: '6000',
            cpm_currency: 'XOF',
            signature: 'sig',
            payment_method: 'MOMO',
            cel_phone_num: '0701020304',
            cpm_phone_prefixe: '225',
            cpm_language: 'fr',
            cpm_version: 'v2',
            cpm_payment_config: 'SINGLE',
            cpm_page_action: 'PAYMENT',
            cpm_custom: '',
            cpm_designation: 'Acompte commande',
            cpm_error_message: ''
        }))

        expect(response.status).toBe(200)
        expect(mockCheckPaymentStatus).toHaveBeenCalledWith('ORD_order_12_1234')
        expect(updates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                table: 'orders',
                value: 'order_123',
                payload: expect.objectContaining({
                    deposit_status: 'paid',
                    status: 'pending_pickup'
                })
            }),
            expect.objectContaining({
                table: 'conversations',
                value: 'conv_1',
                payload: expect.objectContaining({
                    metadata: expect.objectContaining({
                        restaurant: null
                    })
                })
            })
        ]))
        expect(messageInserts).toHaveLength(1)
        expect(messageInserts[0].payload.content).toMatch(/Acompte recu/i)
    })
})
