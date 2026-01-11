import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

describe('Smoke Test: Rate Limiting', () => {
    // This serves as a "Smoke Test" to verify the testing infrastructure works 
    // and that core utility logic is sound.

    it('should allow requests within limit', () => {
        // Use a unique ID for isolation
        const id = 'test-client-1'
        const result = checkRateLimit(id, RATE_LIMITS.api)
        expect(result.success).toBe(true)
    })

    it('should block requests over limit', () => {
        const id = 'test-client-2'
        const limit = { maxRequests: 2, windowMs: 1000 } // 2 requests per second

        // 1st
        checkRateLimit(id, limit)
        // 2nd
        checkRateLimit(id, limit)
        // 3rd (Should fail)
        const result = checkRateLimit(id, limit)

        expect(result.success).toBe(false)
        expect(result.resetTime).toBeGreaterThan(0)
    })
})
