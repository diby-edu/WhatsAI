describe('internal bot client', () => {
    const originalFetch = global.fetch
    const originalBotUrl = process.env.WHATSAPP_BOT_URL
    const originalToken = process.env.WHATSAPP_INTERNAL_API_TOKEN

    beforeEach(() => {
        jest.resetModules()
        global.fetch = jest.fn()
        delete process.env.WHATSAPP_BOT_URL
        delete process.env.WHATSAPP_INTERNAL_API_TOKEN
    })

    afterEach(() => {
        global.fetch = originalFetch
        process.env.WHATSAPP_BOT_URL = originalBotUrl
        process.env.WHATSAPP_INTERNAL_API_TOKEN = originalToken
    })

    test('defaults to the loopback bot URL', () => {
        const { getInternalBotBaseUrl, getInternalBotToken } = require('@/lib/whatsapp/internal-bot')

        expect(getInternalBotBaseUrl()).toBe('http://127.0.0.1:3001')
        expect(getInternalBotToken()).toBeNull()
    })

    test('posts the send payload to the internal bot with the configured token', async () => {
        process.env.WHATSAPP_BOT_URL = 'http://127.0.0.1:3999'
        process.env.WHATSAPP_INTERNAL_API_TOKEN = 'secret-token'
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ success: true, messageId: 'wamid-123' }),
        })

        const { sendMessageViaInternalBot } = require('@/lib/whatsapp/internal-bot')
        const result = await sendMessageViaInternalBot({
            agentId: 'agent-1',
            to: '+22507000000',
            message: 'Bonjour',
        })

        expect(result).toEqual(expect.objectContaining({
            success: true,
            messageId: 'wamid-123',
            statusCode: 200,
        }))

        const [url, options] = global.fetch.mock.calls[0]
        expect(url).toBe('http://127.0.0.1:3999/send')
        expect(options.method).toBe('POST')
        expect(options.headers['X-Internal-Token']).toBe('secret-token')
        expect(JSON.parse(options.body)).toEqual({
            agentId: 'agent-1',
            to: '+22507000000',
            message: 'Bonjour',
        })
    })

    test('returns a structured error when the internal bot rejects the request', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 503,
            json: async () => ({ success: false, error: 'WhatsApp not connected', code: 'SESSION_NOT_CONNECTED' }),
        })

        const { sendMessageViaInternalBot } = require('@/lib/whatsapp/internal-bot')
        const result = await sendMessageViaInternalBot({
            agentId: 'agent-1',
            to: '+22507000000',
            message: 'Bonjour',
        })

        expect(result).toEqual({
            success: false,
            error: 'WhatsApp not connected',
            code: 'SESSION_NOT_CONNECTED',
            statusCode: 503,
        })
    })
})
