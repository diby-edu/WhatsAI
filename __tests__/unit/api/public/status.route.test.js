process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test'

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

// `status/route.ts` calls createAdminClient() once at module load time
// (`const supabaseAdmin = createAdminClient()`), so the mocked client must be
// a stable object whose query result is driven by a mutable ref set per test
// — swapping the mock's return value per-test would have no effect since the
// route module only calls createAdminClient() a single time.
let currentAgent = null

const mockAuthenticateApiKey = jest.fn()
const mockLogApiUsage = jest.fn()

jest.mock('@/lib/api-utils', () => ({
    createAdminClient: () => ({
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn(async () => ({ data: currentAgent, error: null })),
                })),
            })),
        })),
    }),
}))

jest.mock('@/lib/api/public-auth', () => {
    const actual = jest.requireActual('@/lib/api/public-auth')
    return {
        ...actual,
        authenticateApiKey: (...args) => mockAuthenticateApiKey(...args),
    }
})

jest.mock('@/lib/api/log-usage', () => ({
    logApiUsage: (...args) => mockLogApiUsage(...args),
}))

const { GET } = require('@/app/api/public/v1/status/route')

function makeRequest(agentId) {
    return new NextRequest(new Request(`http://localhost/api/public/v1/status?agent_id=${agentId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer sk_live_test' },
    }))
}

describe('GET /api/public/v1/status — agent ownership check', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        currentAgent = null
    })

    test('allows the key owner to read their own agent status', async () => {
        currentAgent = {
            id: 'agent_1', user_id: 'owner_1', name: 'Test Agent',
            is_active: true, whatsapp_connected: true,
        }
        mockAuthenticateApiKey.mockResolvedValue({
            apiKey: { id: 'key_1', allowed_agent_ids: null },
            userId: 'owner_1',
        })

        const response = await GET(makeRequest('agent_1'))
        const payload = await response.json()

        expect(response.status).toBe(200)
        expect(payload.data.agent_id).toBe('agent_1')
    })

    test('rejects a caller who does not own the agent', async () => {
        currentAgent = {
            id: 'agent_1', user_id: 'owner_1', name: 'Test Agent',
            is_active: true, whatsapp_connected: true,
        }
        mockAuthenticateApiKey.mockResolvedValue({
            apiKey: { id: 'key_1', allowed_agent_ids: null },
            userId: 'attacker_1',
        })

        const response = await GET(makeRequest('agent_1'))
        const payload = await response.json()

        expect(response.status).toBe(403)
        expect(payload.code).toBe('UNAUTHORIZED_AGENT')
    })

    // Regression test: a previous version of this route fell back to
    // `agent.user_id || userId` before comparing ownership, which made the
    // check tautologically true whenever agent.user_id was falsy — letting
    // any authenticated API key read the status of an unowned agent.
    test('rejects a caller when the agent row has no owner (falsy user_id)', async () => {
        currentAgent = {
            id: 'agent_1', user_id: null, name: 'Orphan Agent',
            is_active: true, whatsapp_connected: true,
        }
        mockAuthenticateApiKey.mockResolvedValue({
            apiKey: { id: 'key_1', allowed_agent_ids: null },
            userId: 'attacker_1',
        })

        const response = await GET(makeRequest('agent_1'))
        const payload = await response.json()

        expect(response.status).toBe(403)
        expect(payload.code).toBe('UNAUTHORIZED_AGENT')
    })
})
