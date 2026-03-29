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

const { NextResponse } = require('next/server')

const mockCreateApiClient = jest.fn()
const mockGetAuthUser = jest.fn()

jest.mock('@/lib/api-utils', () => ({
    createApiClient: (...args) => mockCreateApiClient(...args),
    getAuthUser: (...args) => mockGetAuthUser(...args),
    successResponse: (data) => NextResponse.json({ data }),
    errorResponse: (message, status = 500) => NextResponse.json({ error: message }, { status })
}))

const { GET } = require('@/app/api/bookings/route')

function createSupabase({ agents = [], bookings = [], bookingsError = null }) {
    return {
        from: jest.fn((table) => {
            if (table === 'agents') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(async () => ({
                            data: agents,
                            error: null
                        }))
                    }))
                }
            }

            if (table === 'bookings') {
                return {
                    select: jest.fn(() => ({
                        in: jest.fn(() => ({
                            order: jest.fn(() => ({
                                limit: jest.fn(async () => ({
                                    data: bookings,
                                    error: bookingsError
                                }))
                            }))
                        }))
                    }))
                }
            }

            throw new Error(`Unexpected table: ${table}`)
        })
    }
}

describe('GET /api/bookings', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('returns 401 when the user is not authenticated', async () => {
        mockCreateApiClient.mockResolvedValue({})
        mockGetAuthUser.mockResolvedValue({ user: null, error: { message: 'unauthorized' } })

        const response = await GET()
        const json = await response.json()

        expect(response.status).toBe(401)
        expect(json.error).toMatch(/Non autoris/i)
    })

    test('returns an empty list when the user has no agents', async () => {
        mockCreateApiClient.mockResolvedValue(createSupabase({ agents: [] }))
        mockGetAuthUser.mockResolvedValue({ user: { id: 'user_1' }, error: null })

        const response = await GET()
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.data).toEqual({ bookings: [] })
    })

    test('normalizes merchant bookings with restaurant metadata and items_count', async () => {
        mockCreateApiClient.mockResolvedValue(createSupabase({
            agents: [{ id: 'agent_1' }],
            bookings: [
                {
                    id: 'booking_123',
                    customer_name: 'Awa Konan',
                    customer_phone: '+2250701020304',
                    booking_type: 'table',
                    booking_source: 'restaurant',
                    service_name: 'Restaurant Lagoon',
                    status: 'pending',
                    start_time: '2026-04-05T20:00:00.000Z',
                    preferred_date: '2026-04-05',
                    preferred_time: '20:00',
                    party_size: 2,
                    location: null,
                    notes: 'Terrasse',
                    price_fcfa: 12000,
                    fulfillment_mode: 'dine_in',
                    payment_method: 'online',
                    deposit_required: true,
                    deposit_amount_fcfa: 3600,
                    deposit_status: 'pending',
                    transaction_id: 'BKG_booking_123',
                    provider_payment_url: 'https://pay.example/bkg-123',
                    created_at: '2026-04-01T10:00:00.000Z',
                    booking_items: [{ id: 'item_1' }, { id: 'item_2' }]
                }
            ]
        }))
        mockGetAuthUser.mockResolvedValue({ user: { id: 'user_1' }, error: null })

        const response = await GET()
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.data.bookings).toHaveLength(1)
        expect(json.data.bookings[0]).toEqual(expect.objectContaining({
            id: 'booking_123',
            booking_source: 'restaurant',
            fulfillment_mode: 'dine_in',
            payment_method: 'online',
            deposit_required: true,
            deposit_amount_fcfa: 3600,
            deposit_status: 'pending',
            transaction_id: 'BKG_booking_123',
            provider_payment_url: 'https://pay.example/bkg-123',
            items_count: 2
        }))
    })
})
