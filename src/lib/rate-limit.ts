// Simple in-memory rate limiter for Next.js
// For production with multiple instances, use Redis-based solution

interface RateLimitEntry {
    count: number
    resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
            rateLimitStore.delete(key)
        }
    }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
    windowMs: number      // Time window in milliseconds
    maxRequests: number   // Max requests per window
}

export interface RateLimitResult {
    success: boolean
    remaining: number
    resetTime: number
}

// Default configs for different endpoints
export const RATE_LIMITS = {
    // API endpoints
    api: { windowMs: 60 * 1000, maxRequests: 100 },        // 100 req/min
    // Auth endpoints (stricter)
    auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },   // 10 req/15min
    // Payment endpoints (very strict)
    payment: { windowMs: 60 * 1000, maxRequests: 5 },      // 5 req/min
    // AI/OpenAI endpoints (moderate)
    ai: { windowMs: 60 * 1000, maxRequests: 20 },          // 20 req/min
    // Webhook (lenient - external services)
    webhook: { windowMs: 60 * 1000, maxRequests: 200 },    // 200 req/min
}

/**
 * Check if request is within rate limits
 * @param identifier - Unique identifier (IP, userId, etc.)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with success status and remaining requests
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig = RATE_LIMITS.api
): RateLimitResult {
    const now = Date.now()
    const key = identifier

    let entry = rateLimitStore.get(key)

    // If no entry or window expired, create new one
    if (!entry || entry.resetTime < now) {
        entry = {
            count: 1,
            resetTime: now + config.windowMs
        }
        rateLimitStore.set(key, entry)

        return {
            success: true,
            remaining: config.maxRequests - 1,
            resetTime: entry.resetTime
        }
    }

    // Check if within limit
    if (entry.count >= config.maxRequests) {
        return {
            success: false,
            remaining: 0,
            resetTime: entry.resetTime
        }
    }

    // Increment counter
    entry.count++
    rateLimitStore.set(key, entry)

    return {
        success: true,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetTime
    }
}

/**
 * Get client identifier from request
 * Prefers user ID if authenticated, falls back to IP
 */
export function getClientIdentifier(
    request: Request,
    userId?: string
): string {
    if (userId) {
        return `user:${userId}`
    }

    // Get IP from various headers (for proxied requests)
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip')

    const ip = cfConnectingIp || realIp || forwarded?.split(',')[0] || 'unknown'

    return `ip:${ip}`
}

/**
 * Create rate limit error response
 */
export function rateLimitResponse(resetTime: number) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)

    return new Response(
        JSON.stringify({
            error: 'Trop de requêtes. Veuillez réessayer plus tard.',
            retryAfter
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
                'X-RateLimit-Reset': String(resetTime)
            }
        }
    )
}
