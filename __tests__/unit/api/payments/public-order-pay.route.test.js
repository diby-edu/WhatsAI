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

const mockCreateClient = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockGetClientIdentifier = jest.fn()
const mockGetDefaultPaymentProvider = jest.fn()
const mockInitializeHostedPayment = jest.fn()
const mockInspectExistingHostedPayment = jest.fn()
const mockNormalizePaymentProvider = jest.fn((value) => value || 'cinetpay')
const mockResolveHostedPaymentProvider = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
    createClient: (...args) => mockCreateClient(...args)
}))

jest.mock('@/lib/rate-limit', () => ({
    checkRateLimit: (...args) => mockCheckRateLimit(...args),
    getClientIdentifier: (...args) => mockGetClientIdentifier(...args),
    RATE_LIMITS: { payment: { limit: 10, windowMs: 60_000 } },
    rateLimitResponse: (resetTime) => NextResponse.json({ error: 'rate_limited', resetTime }, { status: 429 })
}))

jest.mock('@/lib/payments/provider', () => ({
    getDefaultPaymentProvider: (...args) => mockGetDefaultPaymentProvider(...args),
    initializeHostedPayment: (...args) => mockInitializeHostedPayment(...args),
    inspectExistingHostedPayment: (...args) => mockInspectExistingHostedPayment(...args),
    normalizePaymentProvider: (...args) => mockNormalizePaymentProvider(...args),
    resolveHostedPaymentProvider: (...args) => mockResolveHostedPaymentProvider(...args),
}))

process.env.CINETPAY_API_KEY = 'api_key'
process.env.CINETPAY_SITE_ID = 'site_123'
process.env.NEXT_PUBLIC_APP_URL = 'https://wazzapai.com'

const { POST } = require('@/app/api/public/orders/[orderId]/pay/route')

function createSupabaseMock({ order, updates = [] }) {
    return {
        from: jest.fn((table) => ({
            select: jest.fn(() => ({
                eq: jest.fn((_column, value) => ({
                    single: jest.fn(async () => {
                        if (table === 'orders' && value === order.id) {
                            return { data: order, error: null }
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
            }))
        }))
    }
}

function makeRequest() {
    return new NextRequest(new Request('http://localhost/api/public/orders/order_123/pay', {
        method: 'POST'
    }))
}

describe('POST /api/public/orders/[orderId]/pay', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetClientIdentifier.mockReturnValue('client-1')
        mockCheckRateLimit.mockResolvedValue({ success: true })
        mockGetDefaultPaymentProvider.mockResolvedValue('cinetpay')
        mockNormalizePaymentProvider.mockImplementation((value) => value || 'cinetpay')
        mockResolveHostedPaymentProvider.mockImplementation(({ defaultProvider, storedProvider, transactionId, providerPaymentUrl }) => (
            (transactionId || providerPaymentUrl) ? (storedProvider || defaultProvider) : defaultProvider
        ))
        mockInspectExistingHostedPayment.mockResolvedValue({
            action: 'reuse',
            provider: 'cinetpay',
            providerStatus: 'PENDING',
            error: null,
        })
        mockInitializeHostedPayment.mockResolvedValue({
            success: true,
            paymentUrl: 'https://pay.example/order-deposit',
            providerVersion: 'v1',
            providerTransactionId: 'ORD_provider_tx'
        })
    })

    test('charges the restaurant deposit amount instead of the full order total when deposit is pending', async () => {
        const order = {
            id: 'order_123',
            status: 'pending_pickup',
            total_fcfa: 20000,
            deposit_required: true,
            deposit_amount_fcfa: 6000,
            deposit_status: 'pending',
            payment_method: 'online',
            customer_phone: '+2250701020304'
        }
        const updates = []

        mockCreateClient.mockReturnValue(createSupabaseMock({ order, updates }))

        const response = await POST(makeRequest(), { params: Promise.resolve({ orderId: 'order_123' }) })
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json).toEqual(expect.objectContaining({
            success: true,
            payment_url: 'https://pay.example/order-deposit'
        }))
        expect(mockInitializeHostedPayment).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'cinetpay',
            amountFcfa: 6000,
            description: expect.stringMatching(/Acompte commande/),
            metadata: { order_id: 'order_123', type: 'order_deposit' }
        }))

        expect(updates).toHaveLength(1)
        expect(updates[0]).toEqual(expect.objectContaining({
            table: 'orders',
            value: 'order_123',
            payload: expect.objectContaining({
                updated_at: expect.any(String),
                transaction_id: expect.stringMatching(/^ORD_/),
                payment_provider: 'cinetpay',
                provider_payment_url: 'https://pay.example/order-deposit'
            })
        }))
    })

    test('uses Paystack when the default provider is set to paystack', async () => {
        const order = {
            id: 'order_123',
            status: 'pending_pickup',
            total_fcfa: 17600,
            deposit_required: false,
            deposit_amount_fcfa: 0,
            deposit_status: 'not_required',
            payment_method: 'online',
            customer_phone: '+2250701020304',
            payment_provider: null
        }
        const updates = []

        mockGetDefaultPaymentProvider.mockResolvedValue('paystack')
        mockCreateClient.mockReturnValue(createSupabaseMock({ order, updates }))
        mockInitializeHostedPayment.mockResolvedValue({
            success: true,
            paymentUrl: 'https://checkout.paystack.com/abc123',
            providerVersion: 'v1',
            providerTransactionId: 'ORD_paystack_ref'
        })

        const response = await POST(makeRequest(), { params: Promise.resolve({ orderId: 'order_123' }) })
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json).toEqual(expect.objectContaining({
            success: true,
            payment_url: 'https://checkout.paystack.com/abc123',
            provider: 'paystack'
        }))
        expect(mockInitializeHostedPayment).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'paystack',
            amountFcfa: 17600
        }))
        expect(updates[0].payload).toEqual(expect.objectContaining({
            payment_provider: 'paystack',
            provider_payment_url: 'https://checkout.paystack.com/abc123'
        }))
    })

    test('ignores a stale stored cinetpay provider when the order has no initialized hosted payment yet', async () => {
        const order = {
            id: 'order_123',
            status: 'pending_pickup',
            total_fcfa: 17600,
            deposit_required: false,
            deposit_amount_fcfa: 0,
            deposit_status: 'not_required',
            payment_method: 'online',
            customer_phone: '+2250701020304',
            payment_provider: 'cinetpay',
            transaction_id: null,
            provider_payment_url: null,
        }
        const updates = []

        mockGetDefaultPaymentProvider.mockResolvedValue('paystack')
        mockCreateClient.mockReturnValue(createSupabaseMock({ order, updates }))
        mockInitializeHostedPayment.mockResolvedValue({
            success: true,
            paymentUrl: 'https://checkout.paystack.com/new-order',
            providerVersion: 'v1',
            providerTransactionId: 'ORD_paystack_new'
        })

        const response = await POST(makeRequest(), { params: Promise.resolve({ orderId: 'order_123' }) })
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json).toEqual(expect.objectContaining({
            success: true,
            payment_url: 'https://checkout.paystack.com/new-order',
            provider: 'paystack'
        }))
        expect(mockResolveHostedPaymentProvider).toHaveBeenCalledWith({
            defaultProvider: 'paystack',
            storedProvider: 'cinetpay',
            transactionId: null,
            providerPaymentUrl: null,
        })
        expect(mockInitializeHostedPayment).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'paystack',
        }))
    })

    test('reuses an existing hosted order link only when the provider still reports it pending', async () => {
        const order = {
            id: 'order_123',
            status: 'pending_pickup',
            total_fcfa: 17600,
            deposit_required: false,
            deposit_amount_fcfa: 0,
            deposit_status: 'not_required',
            payment_method: 'online',
            customer_phone: '+2250701020304',
            transaction_id: 'ORD_existing',
            provider_payment_url: 'https://pay.example/existing',
            payment_provider: 'paystack',
            payment_provider_version: 'v1',
        }

        mockNormalizePaymentProvider.mockReturnValue('paystack')
        mockInspectExistingHostedPayment.mockResolvedValue({
            action: 'reuse',
            provider: 'paystack',
            providerStatus: 'PENDING',
            error: null,
        })
        mockCreateClient.mockReturnValue(createSupabaseMock({ order, updates: [] }))

        const response = await POST(makeRequest(), { params: Promise.resolve({ orderId: 'order_123' }) })
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json).toEqual({
            success: true,
            payment_url: 'https://pay.example/existing',
            transaction_id: 'ORD_existing',
            provider: 'paystack',
        })
        expect(mockInitializeHostedPayment).not.toHaveBeenCalled()
    })

    test('returns 409 when the existing hosted order payment is already accepted', async () => {
        const order = {
            id: 'order_123',
            status: 'pending_pickup',
            total_fcfa: 17600,
            deposit_required: false,
            deposit_amount_fcfa: 0,
            deposit_status: 'not_required',
            payment_method: 'online',
            customer_phone: '+2250701020304',
            transaction_id: 'ORD_existing',
            provider_payment_url: 'https://pay.example/existing',
            payment_provider: 'paystack',
            payment_provider_version: 'v1',
        }

        mockNormalizePaymentProvider.mockReturnValue('paystack')
        mockInspectExistingHostedPayment.mockResolvedValue({
            action: 'accepted',
            provider: 'paystack',
            providerStatus: 'ACCEPTED',
            error: null,
        })
        mockCreateClient.mockReturnValue(createSupabaseMock({ order, updates: [] }))

        const response = await POST(makeRequest(), { params: Promise.resolve({ orderId: 'order_123' }) })
        const json = await response.json()

        expect(response.status).toBe(409)
        expect(json.error).toMatch(/deja ete valide/i)
        expect(mockInitializeHostedPayment).not.toHaveBeenCalled()
    })
})
