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

const mockCreateApiClient = jest.fn()
const mockGetAuthUser = jest.fn()

jest.mock('@/lib/api-utils', () => ({
    createApiClient: (...args) => mockCreateApiClient(...args),
    getAuthUser: (...args) => mockGetAuthUser(...args),
    errorResponse: (message, status = 400) => Response.json({ success: false, error: message }, { status }),
    successResponse: (data, status = 200) => Response.json({ success: true, data }, { status }),
}))

const { POST } = require('@/app/api/conversations/[id]/pause/route')

function makeRequest(body) {
    return new NextRequest(new Request('http://localhost/api/conversations/conv_1/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    }))
}

function createSupabaseMock({ conversation, updatedConversation }) {
    const fetchSingle = jest.fn(async () => ({ data: conversation, error: null }))
    const fetchEq = jest.fn(() => ({ single: fetchSingle }))
    const fetchSelect = jest.fn(() => ({ eq: fetchEq }))

    const updateSingle = jest.fn(async () => ({ data: updatedConversation, error: null }))
    const updateSelect = jest.fn(() => ({ single: updateSingle }))
    const updateEq = jest.fn(() => ({ select: updateSelect }))
    const updateUpdate = jest.fn(() => ({ eq: updateEq }))

    return {
        supabase: {
            from: jest.fn(() => ({
                select: fetchSelect,
                update: updateUpdate,
            })),
        },
        spies: {
            fetchSelect,
            fetchEq,
            updateUpdate,
            updateEq,
        },
    }
}

describe('POST /api/conversations/[id]/pause', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetAuthUser.mockResolvedValue({
            user: { id: 'user_1' },
            error: null,
        })
    })

    test('resolves an escalated conversation when the bot is resumed', async () => {
        const { supabase, spies } = createSupabaseMock({
            conversation: {
                id: 'conv_1',
                user_id: 'user_1',
                bot_paused: true,
                status: 'escalated',
            },
            updatedConversation: {
                id: 'conv_1',
                bot_paused: false,
                status: 'active',
            },
        })

        mockCreateApiClient.mockResolvedValue(supabase)

        const response = await POST(makeRequest({ paused: false }), {
            params: Promise.resolve({ id: 'conv_1' }),
        })
        const payload = await response.json()

        expect(response.status).toBe(200)
        expect(spies.updateUpdate).toHaveBeenCalledWith({
            bot_paused: false,
            status: 'active',
        })
        expect(payload.data).toEqual(expect.objectContaining({
            bot_paused: false,
            status: 'active',
        }))
    })

    test('keeps the conversation active when manually pausing the bot', async () => {
        const { supabase, spies } = createSupabaseMock({
            conversation: {
                id: 'conv_1',
                user_id: 'user_1',
                bot_paused: false,
                status: 'active',
            },
            updatedConversation: {
                id: 'conv_1',
                bot_paused: true,
                status: 'active',
            },
        })

        mockCreateApiClient.mockResolvedValue(supabase)

        const response = await POST(makeRequest({ paused: true }), {
            params: Promise.resolve({ id: 'conv_1' }),
        })
        const payload = await response.json()

        expect(response.status).toBe(200)
        expect(spies.updateUpdate).toHaveBeenCalledWith({
            bot_paused: true,
        })
        expect(payload.data).toEqual(expect.objectContaining({
            bot_paused: true,
            status: 'active',
        }))
    })
})
