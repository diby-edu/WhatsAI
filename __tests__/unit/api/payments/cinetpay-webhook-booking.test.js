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

function createSupabaseMock({ booking, linkedConversation = { id: 'conv_1' }, updates = [], inserts = [] }) {
    return {
        from: jest.fn((table) => ({
            select: jest.fn(() => ({
                eq: jest.fn((firstColumn, firstValue) => ({
                    eq: jest.fn((secondColumn, secondValue) => ({
                        single: jest.fn(async () => {
                            if (table === 'conversations' && firstColumn === 'agent_id' && secondColumn === 'contact_phone') {
                                return linkedConversation
                                    ? { data: linkedConversation, error: null }
                                    : { data: null, error: { message: 'not found' } }
                            }
                            return { data: null, error: { message: 'not found' } }
                        })
                    })),
                    single: jest.fn(async () => {
                        if (table === 'bookings' && firstColumn === 'transaction_id' && firstValue === booking.transaction_id) {
                            return { data: booking, error: null }
                        }
                        if (table === 'conversations' && firstColumn === 'id' && firstValue === booking.conversation_id) {
                            return linkedConversation
                                ? { data: linkedConversation, error: null }
                                : { data: null, error: { message: 'not found' } }
                        }
                        return { data: null, error: { message: 'not found' } }
                    })
                }))
            })),
            update: jest.fn((payload) => ({
                eq: jest.fn(async (_column, value) => {
                    updates.push({ table, value, payload })
                    return { error: null }
                })
            })),
            insert: jest.fn(async (payload) => {
                inserts.push({ table, payload })
                return { data: { id: `${table}_1` }, error: null }
            })
        }))
    }
}

describe('POST /api/payments/cinetpay/webhook for BKG_*', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env.CINETPAY_SECRET_KEY = 'secret'
        process.env.CINETPAY_SITE_ID = 'site_123'
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example'
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
        mockVerifyWebhookSignature.mockReturnValue(true)
        mockFinalizePaymentByTransaction.mockResolvedValue({ ok: true, state: 'not_found' })
    })

    test('marks booking deposit as paid and queues a confirmation message when CinetPay accepts', async () => {
        const booking = {
            id: 'booking_123',
            transaction_id: 'BKG_booking_1_1234',
            deposit_status: 'pending',
            status: 'pending',
            deposit_amount_fcfa: 5000,
            service_name: 'Diner sur place',
            start_time: '2026-04-10T20:00:00.000Z',
            agent_id: 'agent_1',
            conversation_id: 'conv_1',
            customer_phone: '+2250701020304'
        }
        const updates = []
        const inserts = []

        mockCreateClient.mockReturnValue(createSupabaseMock({ booking, updates, inserts }))
        mockCheckPaymentStatus.mockResolvedValue({ status: 'ACCEPTED', amount: 5000 })

        const response = await POST(makeWebhookRequest({
            cpm_site_id: 'site_123',
            cpm_trans_id: 'BKG_booking_1_1234',
            cpm_trans_date: '20260329120000',
            cpm_amount: '5000',
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
            cpm_designation: 'Acompte',
            cpm_error_message: ''
        }))

        expect(response.status).toBe(200)
        expect(mockCheckPaymentStatus).toHaveBeenCalledWith('BKG_booking_1_1234')
        expect(updates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                table: 'bookings',
                value: 'booking_123',
                payload: expect.objectContaining({
                    deposit_status: 'paid',
                    status: 'confirmed'
                })
            })
        ]))
        expect(inserts).toEqual(expect.arrayContaining([
            expect.objectContaining({
                table: 'messages',
                payload: expect.objectContaining({
                    conversation_id: 'conv_1',
                    role: 'assistant'
                })
            })
        ]))
        expect(mockNotify).not.toHaveBeenCalled()
    })

    test('marks booking deposit as expired when CinetPay refuses or cancels', async () => {
        const booking = {
            id: 'booking_123',
            transaction_id: 'BKG_booking_1_1234',
            deposit_status: 'pending',
            status: 'pending',
            deposit_amount_fcfa: 5000,
            service_name: 'Diner sur place',
            start_time: null,
            agent_id: 'agent_1',
            conversation_id: 'conv_1',
            customer_phone: '+2250701020304'
        }
        const updates = []
        const inserts = []

        mockCreateClient.mockReturnValue(createSupabaseMock({ booking, updates, inserts }))
        mockCheckPaymentStatus.mockResolvedValue({ status: 'REFUSED' })

        const response = await POST(makeWebhookRequest({
            cpm_site_id: 'site_123',
            cpm_trans_id: 'BKG_booking_1_1234',
            cpm_trans_date: '20260329120000',
            cpm_amount: '5000',
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
            cpm_designation: 'Acompte',
            cpm_error_message: ''
        }))

        expect(response.status).toBe(200)
        expect(updates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                table: 'bookings',
                value: 'booking_123',
                payload: expect.objectContaining({
                    deposit_status: 'expired'
                })
            })
        ]))
        expect(inserts).toHaveLength(0)
    })

    test('is idempotent when the booking deposit is already paid', async () => {
        const booking = {
            id: 'booking_123',
            transaction_id: 'BKG_booking_1_1234',
            deposit_status: 'paid',
            status: 'confirmed',
            deposit_amount_fcfa: 5000,
            service_name: 'Diner sur place',
            start_time: null,
            agent_id: 'agent_1',
            conversation_id: 'conv_1',
            customer_phone: '+2250701020304'
        }
        const updates = []
        const inserts = []

        mockCreateClient.mockReturnValue(createSupabaseMock({ booking, updates, inserts }))

        const response = await POST(makeWebhookRequest({
            cpm_site_id: 'site_123',
            cpm_trans_id: 'BKG_booking_1_1234',
            cpm_trans_date: '20260329120000',
            cpm_amount: '5000',
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
            cpm_designation: 'Acompte',
            cpm_error_message: ''
        }))

        expect(response.status).toBe(200)
        expect(mockCheckPaymentStatus).not.toHaveBeenCalled()
        expect(updates).toHaveLength(0)
        expect(inserts).toHaveLength(0)
    })
})
