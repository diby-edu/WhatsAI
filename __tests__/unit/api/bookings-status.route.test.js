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
const mockGetAuthUser = jest.fn()

jest.mock('@/lib/api-utils', () => ({
    createApiClient: (...args) => mockCreateApiClient(...args),
    getAuthUser: (...args) => mockGetAuthUser(...args),
    successResponse: (data) => NextResponse.json({ data }),
    errorResponse: (message, status = 500) => NextResponse.json({ error: message }, { status })
}))

const { PATCH } = require('@/app/api/bookings/[id]/status/route')

function createSupabase({ booking, agent, updates = [] }) {
    return {
        from: jest.fn((table) => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: async () => {
                        if (table === 'bookings') {
                            return booking
                                ? { data: booking, error: null }
                                : { data: null, error: { message: 'not found' } }
                        }

                        if (table === 'agents') {
                            return agent
                                ? { data: agent, error: null }
                                : { data: null, error: { message: 'not found' } }
                        }

                        return { data: null, error: { message: 'not found' } }
                    }
                }))
            })),
            update: jest.fn((payload) => ({
                eq: jest.fn(async () => {
                    updates.push({ table, payload })
                    return { error: null }
                })
            }))
        }))
    }
}

function makeRequest(body) {
    return new NextRequest(new Request('http://localhost/api/bookings/booking_123/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    }))
}

describe('PATCH /api/bookings/[id]/status', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetAuthUser.mockResolvedValue({ user: { id: 'user_1' }, error: null })
    })

    test('blocks confirmation when a restaurant deposit is still pending', async () => {
        const updates = []
        mockCreateApiClient.mockResolvedValue(createSupabase({
            booking: {
                id: 'booking_123',
                agent_id: 'agent_1',
                status: 'pending',
                customer_phone: '+2250701020304',
                customer_name: 'Awa Konan',
                service_name: 'Restaurant Lagoon',
                start_time: '2026-04-05T20:00:00.000Z',
                deposit_required: true,
                deposit_status: 'pending',
                booking_source: 'restaurant'
            },
            agent: { id: 'agent_1', user_id: 'user_1' },
            updates
        }))

        const response = await PATCH(makeRequest({ status: 'confirmed' }), {
            params: Promise.resolve({ id: 'booking_123' })
        })
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toMatch(/Acompte en attente/i)
        expect(updates).toHaveLength(0)
    })

    test('allows confirmation when the deposit is already paid', async () => {
        const updates = []
        mockCreateApiClient.mockResolvedValue(createSupabase({
            booking: {
                id: 'booking_123',
                agent_id: 'agent_1',
                status: 'pending',
                customer_phone: null,
                customer_name: 'Awa Konan',
                service_name: 'Restaurant Lagoon',
                start_time: '2026-04-05T20:00:00.000Z',
                deposit_required: true,
                deposit_status: 'paid',
                booking_source: 'restaurant'
            },
            agent: { id: 'agent_1', user_id: 'user_1' },
            updates
        }))

        const response = await PATCH(makeRequest({ status: 'confirmed' }), {
            params: Promise.resolve({ id: 'booking_123' })
        })
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.data.message).toMatch(/Statut mis/i)
        expect(json.data.message).toMatch(/confirmed/i)
        expect(updates).toHaveLength(1)
        expect(updates[0].payload).toEqual(expect.objectContaining({
            status: 'confirmed'
        }))
    })

    test('allows the merchant to mark a pending restaurant deposit as paid and auto-confirms the booking', async () => {
        const updates = []
        mockCreateApiClient.mockResolvedValue(createSupabase({
            booking: {
                id: 'booking_123',
                agent_id: 'agent_1',
                status: 'pending',
                customer_phone: null,
                customer_name: 'Awa Konan',
                service_name: 'Restaurant Lagoon',
                start_time: '2026-04-05T20:00:00.000Z',
                deposit_required: true,
                deposit_status: 'pending',
                booking_source: 'restaurant'
            },
            agent: { id: 'agent_1', user_id: 'user_1' },
            updates
        }))

        const response = await PATCH(makeRequest({ deposit_status: 'paid' }), {
            params: Promise.resolve({ id: 'booking_123' })
        })
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json.data).toEqual(expect.objectContaining({
            newStatus: 'confirmed',
            depositStatus: 'paid'
        }))
        expect(updates).toHaveLength(1)
        expect(updates[0].payload).toEqual(expect.objectContaining({
            status: 'confirmed',
            deposit_status: 'paid'
        }))
    })

    test('rejects invalid merchant deposit transitions', async () => {
        const updates = []
        mockCreateApiClient.mockResolvedValue(createSupabase({
            booking: {
                id: 'booking_123',
                agent_id: 'agent_1',
                status: 'confirmed',
                customer_phone: null,
                customer_name: 'Awa Konan',
                service_name: 'Restaurant Lagoon',
                start_time: '2026-04-05T20:00:00.000Z',
                deposit_required: true,
                deposit_status: 'paid',
                booking_source: 'restaurant'
            },
            agent: { id: 'agent_1', user_id: 'user_1' },
            updates
        }))

        const response = await PATCH(makeRequest({ deposit_status: 'expired' }), {
            params: Promise.resolve({ id: 'booking_123' })
        })
        const json = await response.json()

        expect(response.status).toBe(400)
        expect(json.error).toMatch(/Transition de statut acompte invalide/i)
        expect(updates).toHaveLength(0)
    })
})
