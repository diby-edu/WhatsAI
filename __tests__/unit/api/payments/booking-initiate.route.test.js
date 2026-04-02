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

const { NextRequest, NextResponse } = require('next/server')

const mockCreateApiClient = jest.fn()
const mockCreateAdminClient = jest.fn()
const mockGetAuthUser = jest.fn()
const mockGetDefaultPaymentProvider = jest.fn()
const mockInitializeHostedPayment = jest.fn()
const mockNormalizePaymentProvider = jest.fn((value) => value || 'cinetpay')

jest.mock('@/lib/api-utils', () => ({
    createApiClient: (...args) => mockCreateApiClient(...args),
    createAdminClient: (...args) => mockCreateAdminClient(...args),
    getAuthUser: (...args) => mockGetAuthUser(...args),
    errorResponse: (message, status = 500) => NextResponse.json({ error: message }, { status })
}))

jest.mock('@/lib/payments/provider', () => ({
    getDefaultPaymentProvider: (...args) => mockGetDefaultPaymentProvider(...args),
    initializeHostedPayment: (...args) => mockInitializeHostedPayment(...args),
    normalizePaymentProvider: (...args) => mockNormalizePaymentProvider(...args),
}))

const { POST } = require('@/app/api/payments/cinetpay/booking-initiate/route')

function createAdminSupabase({ booking, agent, updateError = null, updates = [] }) {
    return {
        from: jest.fn((table) => ({
            select: jest.fn(() => ({
                eq: jest.fn((_column, value) => ({
                    single: jest.fn(async () => {
                        if (table === 'bookings') {
                            return booking && value === booking.id
                                ? { data: booking, error: null }
                                : { data: null, error: { message: 'not found' } }
                        }

                        if (table === 'agents') {
                            return agent && value === booking.agent_id
                                ? { data: agent, error: null }
                                : { data: null, error: { message: 'not found' } }
                        }

                        return { data: null, error: { message: 'not found' } }
                    })
                }))
            })),
            update: jest.fn((payload) => ({
                eq: jest.fn(async (_column, value) => {
                    updates.push({ table, value, payload })
                    return { error: updateError }
                })
            }))
        }))
    }
}

function makeRequest(body) {
    return new NextRequest(new Request('http://localhost/api/payments/cinetpay/booking-initiate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    }))
}

describe('POST /api/payments/cinetpay/booking-initiate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env.NEXT_PUBLIC_APP_URL = 'https://wazzapai.com'
        mockCreateApiClient.mockResolvedValue({})
        mockGetAuthUser.mockResolvedValue({ user: { id: 'user_1' }, error: null })
        mockGetDefaultPaymentProvider.mockResolvedValue('cinetpay')
        mockInitializeHostedPayment.mockResolvedValue({
            success: true,
            paymentUrl: 'https://pay.example/new-link',
            providerVersion: 'v1',
            providerTransactionId: 'BKG_provider_tx'
        })
    })

    test('returns the existing payment link when the booking already has transaction_id + provider_payment_url', async () => {
        const booking = {
            id: 'booking_123',
            agent_id: 'agent_1',
            deposit_required: true,
            deposit_amount_fcfa: 5000,
            deposit_status: 'pending',
            payment_method: 'online',
            transaction_id: 'BKG_existing',
            provider_payment_url: 'https://pay.example/existing'
        }
        const updates = []

        mockCreateAdminClient.mockReturnValue(
            createAdminSupabase({
                booking,
                agent: { user_id: 'user_1' },
                updates
            })
        )

        const response = await POST(makeRequest({ booking_id: 'booking_123' }))
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json).toEqual({
            success: true,
            payment_url: 'https://pay.example/existing',
            transaction_id: 'BKG_existing'
        })
        expect(mockInitializeHostedPayment).not.toHaveBeenCalled()
        expect(updates).toHaveLength(0)
    })

    test('creates a new hosted payment and persists transaction_id + provider_payment_url', async () => {
        const booking = {
            id: 'booking_123',
            agent_id: 'agent_1',
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            deposit_required: true,
            deposit_amount_fcfa: 5000,
            deposit_status: 'pending',
            payment_method: 'online',
            transaction_id: null,
            provider_payment_url: null
        }
        const updates = []

        mockCreateAdminClient.mockReturnValue(
            createAdminSupabase({
                booking,
                agent: { user_id: 'user_1' },
                updates
            })
        )

        const response = await POST(makeRequest({ booking_id: 'booking_123' }))
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.success).toBe(true)
        expect(json.payment_url).toBe('https://pay.example/new-link')
        expect(json.transaction_id).toMatch(/^BKG_/)
        expect(json.transaction_id).toContain(booking.id.substring(0, 8))
        expect(mockInitializeHostedPayment).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'cinetpay',
            amountFcfa: 5000,
            currency: 'XOF',
            customerName: 'Awa Konan',
            customerPhone: '+2250701020304',
            notifyUrl: 'https://wazzapai.com/api/payments/cinetpay/webhook',
            metadata: { booking_id: 'booking_123', type: 'booking_deposit' }
        }))
        expect(updates).toHaveLength(1)
        expect(updates[0].payload).toEqual(expect.objectContaining({
            payment_provider: 'cinetpay',
            provider_payment_url: 'https://pay.example/new-link'
        }))
        expect(updates[0].payload.transaction_id).toMatch(/^BKG_/)
        expect(updates[0].payload.transaction_id).toContain(booking.id.substring(0, 8))
    })

    test('rejects bookings that are not payable online in their current state', async () => {
        const booking = {
            id: 'booking_123',
            agent_id: 'agent_1',
            status: 'pending',
            deposit_required: true,
            deposit_amount_fcfa: 5000,
            deposit_status: 'expired',
            payment_method: 'online',
            transaction_id: null,
            provider_payment_url: null
        }

        mockCreateAdminClient.mockReturnValue(
            createAdminSupabase({
                booking,
                agent: { user_id: 'user_1' },
                updates: []
            })
        )

        const response = await POST(makeRequest({ booking_id: 'booking_123' }))
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toMatch(/not payable/i)
        expect(mockInitializeHostedPayment).not.toHaveBeenCalled()
    })

    test('rejects terminal bookings before creating or reusing a payment link', async () => {
        const booking = {
            id: 'booking_123',
            agent_id: 'agent_1',
            status: 'cancelled',
            deposit_required: true,
            deposit_amount_fcfa: 5000,
            deposit_status: 'pending',
            payment_method: 'online',
            transaction_id: 'BKG_existing',
            provider_payment_url: 'https://pay.example/existing'
        }

        mockCreateAdminClient.mockReturnValue(
            createAdminSupabase({
                booking,
                agent: { user_id: 'user_1' },
                updates: []
            })
        )

        const response = await POST(makeRequest({ booking_id: 'booking_123' }))
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toMatch(/no longer payable/i)
        expect(mockInitializeHostedPayment).not.toHaveBeenCalled()
    })

    test('uses Paystack when the admin default provider is paystack', async () => {
        const booking = {
            id: 'booking_123',
            agent_id: 'agent_1',
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            deposit_required: true,
            deposit_amount_fcfa: 5000,
            deposit_status: 'pending',
            payment_method: 'online',
            transaction_id: null,
            provider_payment_url: null,
            payment_provider: null
        }
        const updates = []

        mockGetDefaultPaymentProvider.mockResolvedValue('paystack')
        mockCreateAdminClient.mockReturnValue(
            createAdminSupabase({
                booking,
                agent: { user_id: 'user_1' },
                updates
            })
        )
        mockInitializeHostedPayment.mockResolvedValue({
            success: true,
            paymentUrl: 'https://checkout.paystack.com/booking123',
            providerVersion: 'v1',
            providerTransactionId: 'BKG_paystack_ref'
        })

        const response = await POST(makeRequest({ booking_id: 'booking_123' }))
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.provider).toBe('paystack')
        expect(mockInitializeHostedPayment).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'paystack',
            notifyUrl: 'https://wazzapai.com/api/payments/paystack/webhook'
        }))
        expect(updates[0].payload).toEqual(expect.objectContaining({
            payment_provider: 'paystack',
            provider_payment_url: 'https://checkout.paystack.com/booking123'
        }))
    })
})
