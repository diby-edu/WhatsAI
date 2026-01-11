import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// --- CONFIGURATION ---

export interface RateLimitConfig {
    windowMs: number      // Time window in milliseconds
    maxRequests: number   // Max requests per window
}

export interface RateLimitResult {
    success: boolean
    remaining: number
    resetTime: number
}

// Default configs (same as before)
export const RATE_LIMITS = {
    api: { windowMs: 60 * 1000, maxRequests: 100 },
    auth: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
    payment: { windowMs: 60 * 1000, maxRequests: 5 },
    ai: { windowMs: 60 * 1000, maxRequests: 20 },
    webhook: { windowMs: 60 * 1000, maxRequests: 200 },
}

// --- REDIS SETUP ---

// Fallback for local dev without Redis (Memory)
const cache = new Map()

let redis: Redis | undefined
try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = Redis.fromEnv()
    } else {
        console.warn('⚠️ Redis not configured, falling back to in-memory rate limiting')
    }
} catch (error) {
    console.error('❌ Failed to initialize Redis:', error)
}

// --- CORE LOGIC ---

/**
 * Check if request is within rate limits using Redis (or fallback to Memory)
 */
export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig = RATE_LIMITS.api
): Promise<RateLimitResult> {

    // 1. Redis Strategy (Production / Distributed)
    if (redis) {
        try {
            // Converts windowMs (ex: 60000) to seconds format string "60 s"
            const windowSeconds = Math.ceil(config.windowMs / 1000)

            const limiter = new Ratelimit({
                redis: redis,
                limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds} s`),
                analytics: true,
                prefix: "@upstash/ratelimit",
            })

            const { success, limit, remaining, reset } = await limiter.limit(identifier)

            return {
                success,
                remaining,
                resetTime: reset
            }
        } catch (error) {
            console.error('🔥 Redis RateLimit Error:', error)
            // Fallback to allow if Redis fails? Or block?
            // Let's fallback to allow to not break uptime, but log big error
            return { success: true, remaining: 1, resetTime: Date.now() }
        }
    }

    // 2. Memory Strategy (Fallback / Local)
    const now = Date.now()
    let entry = cache.get(identifier)

    if (!entry || entry.resetTime < now) {
        entry = { count: 1, resetTime: now + config.windowMs }
        cache.set(identifier, entry)
        return { success: true, remaining: config.maxRequests - 1, resetTime: entry.resetTime }
    }

    if (entry.count >= config.maxRequests) {
        return { success: false, remaining: 0, resetTime: entry.resetTime }
    }

    entry.count++
    cache.set(identifier, entry)
    return { success: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime }
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: Request, userId?: string): string {
    if (userId) return `user:${userId}`
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = request.headers.get('x-real-ip') || forwarded?.split(',')[0] || 'unknown'
    return `ip:${ip}`
}

/**
 * Create rate limit error response
 */
export function rateLimitResponse(resetTime: number) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
    return new Response(JSON.stringify({ error: 'Trop de requêtes. Réessayez plus tard.' }), {
        status: 429,
        headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Reset': String(resetTime)
        }
    })
}
