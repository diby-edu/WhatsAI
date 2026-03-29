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

jest.mock('@supabase/supabase-js', () => ({
    createClient: (...args) => mockCreateClient(...args)
}))

jest.mock('@/lib/rate-limit', () => ({
    checkRateLimit: (...args) => mockCheckRateLimit(...args),
    getClientIdentifier: (...args) => mockGetClientIdentifier(...args),
    RATE_LIMITS: { payment: { limit: 10, windowMs: 60_000 } },
    rateLimitResponse: (resetTime) => NextResponse.json({ error: 'rate_limited', resetTime }, { status: 429 })
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
    const originalFetch = global.fetch

    beforeEach(() => {
        jest.clearAllMocks()
        mockGetClientIdentifier.mockReturnValue('client-1')
        mockCheckRateLimit.mockResolvedValue({ success: true })
    })

    afterAll(() => {
        global.fetch = originalFetch
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
        global.fetch = jest.fn().mockResolvedValue({
            json: async () => ({
                code: '201',
                data: {
                    payment_url: 'https://pay.example/order-deposit'
                }
            })
        })

        const response = await POST(makeRequest(), { params: Promise.resolve({ orderId: 'order_123' }) })
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json).toEqual(expect.objectContaining({
            success: true,
            payment_url: 'https://pay.example/order-deposit'
        }))
        expect(global.fetch).toHaveBeenCalledTimes(1)

        const [, fetchOptions] = global.fetch.mock.calls[0]
        const payload = JSON.parse(fetchOptions.body)
        expect(payload.amount).toBe(6000)
        expect(payload.description).toMatch(/Acompte commande/)
        expect(payload.metadata).toContain('"type":"order_deposit"')

        expect(updates).toHaveLength(1)
        expect(updates[0]).toEqual(expect.objectContaining({
            table: 'orders',
            value: 'order_123',
            payload: expect.objectContaining({
                updated_at: expect.any(String),
                transaction_id: expect.stringMatching(/^ORD_/)
            })
        }))
    })
})
