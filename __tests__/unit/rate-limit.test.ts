jest.mock('@upstash/redis', () => ({
    Redis: {
        fromEnv: jest.fn(() => ({}))
    }
}))

jest.mock('@upstash/ratelimit', () => ({
    Ratelimit: class MockRatelimit {
        static slidingWindow = jest.fn(() => ({}))

        limit = jest.fn(async () => ({
            success: true,
            remaining: 99,
            reset: Date.now() + 60_000
        }))
    }
}))

const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
const { checkRateLimit, RATE_LIMITS } = require('@/lib/rate-limit')

describe('Smoke Test: Rate Limiting', () => {
    afterAll(() => {
        consoleWarnSpy.mockRestore()
    })

    it('should allow requests within limit', async () => {
        const id = 'test-client-1'
        const result = await checkRateLimit(id, RATE_LIMITS.api)

        expect(result.success).toBe(true)
        expect(result.remaining).toBeLessThan(RATE_LIMITS.api.maxRequests)
    })

    it('should block requests over limit', async () => {
        const id = 'test-client-2'
        const limit = { maxRequests: 2, windowMs: 1000 }

        await checkRateLimit(id, limit)
        await checkRateLimit(id, limit)
        const result = await checkRateLimit(id, limit)

        expect(result.success).toBe(false)
        expect(result.resetTime).toBeGreaterThan(0)
    })
})
