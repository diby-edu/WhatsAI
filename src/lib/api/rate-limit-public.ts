/**
 * Rate limiting pour l'API publique — Redis (Upstash) avec fallback in-memory.
 * Trois niveaux : par clé API, par user_id, par numéro cible (anti-spam).
 */

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// --- In-memory fallback ---

interface RateRecord {
    count: number
    resetAt: number
}

const stores = {
    byKey: new Map<string, RateRecord>(),
    byUser: new Map<string, RateRecord>(),
    byPhone: new Map<string, RateRecord>(),
}

// Nettoyage toutes les 10 minutes
setInterval(() => {
    const now = Date.now()
    for (const store of Object.values(stores)) {
        for (const [key, rec] of store.entries()) {
            if (now > rec.resetAt) store.delete(key)
        }
    }
}, 10 * 60 * 1000)

// --- Redis setup ---

const IS_BUILD = process.env.npm_lifecycle_event === 'build'

let redis: Redis | undefined
try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = Redis.fromEnv()
    } else if (!IS_BUILD) {
        console.warn('⚠️ Redis not configured, rate-limit-public falling back to in-memory')
    }
} catch (err) {
    if (!IS_BUILD) console.error('❌ Redis init error (rate-limit-public):', err)
}

// --- Types ---

export interface RateLimitResult {
    allowed: boolean
    headers: Record<string, string>
    reason?: string
}

// --- Main export ---

/**
 * Vérifie les 3 niveaux de rate limiting pour une requête API publique.
 * Utilise Redis si disponible, sinon in-memory.
 */
export async function checkPublicRateLimit(
    keyId: string,
    userId: string,
    targetPhone: string | null,
    limitPerMin: number
): Promise<RateLimitResult> {
    if (redis) {
        try {
            return await checkRedis(keyId, userId, targetPhone, limitPerMin)
        } catch (err) {
            console.error('🔥 Redis rate limit error, falling back to in-memory:', err)
        }
    }
    return checkInMemory(keyId, userId, targetPhone, limitPerMin)
}

// --- Redis strategy ---

async function checkRedis(
    keyId: string,
    userId: string,
    targetPhone: string | null,
    limitPerMin: number
): Promise<RateLimitResult> {
    // Niveau 1 : par clé API
    const keyLimiter = new Ratelimit({ redis: redis!, limiter: Ratelimit.slidingWindow(limitPerMin, '60 s'), prefix: 'rl:key' })
    const keyResult = await keyLimiter.limit(keyId)
    if (!keyResult.success) {
        return {
            allowed: false,
            reason: `Rate limit exceeded: ${limitPerMin} requests/minute per API key`,
            headers: {
                'X-RateLimit-Limit': String(limitPerMin),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil(keyResult.reset / 1000)),
                'Retry-After': '60',
            },
        }
    }

    // Niveau 2 : par user (200/min global)
    const userLimiter = new Ratelimit({ redis: redis!, limiter: Ratelimit.slidingWindow(200, '60 s'), prefix: 'rl:user' })
    const userResult = await userLimiter.limit(userId)
    if (!userResult.success) {
        return {
            allowed: false,
            reason: 'Global rate limit exceeded: 200 requests/minute per account',
            headers: {
                'X-RateLimit-Limit': '200',
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil(userResult.reset / 1000)),
                'Retry-After': '60',
            },
        }
    }

    // Niveau 3 : anti-spam par numéro cible (5/24h)
    if (targetPhone) {
        const phoneLimiter = new Ratelimit({ redis: redis!, limiter: Ratelimit.slidingWindow(5, '86400 s'), prefix: 'rl:phone' })
        const phoneResult = await phoneLimiter.limit(targetPhone)
        if (!phoneResult.success) {
            return {
                allowed: false,
                reason: 'Anti-spam limit: max 5 messages per phone number per 24h',
                headers: {
                    'X-RateLimit-Limit': '5',
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(Math.ceil(phoneResult.reset / 1000)),
                    'Retry-After': '86400',
                },
            }
        }
    }

    return {
        allowed: true,
        headers: {
            'X-RateLimit-Limit': String(limitPerMin),
            'X-RateLimit-Remaining': String(keyResult.remaining),
            'X-RateLimit-Reset': String(Math.ceil(keyResult.reset / 1000)),
        },
    }
}

// --- In-memory strategy (fallback) ---

function memCheck(store: Map<string, RateRecord>, key: string, limit: number, windowMs: number) {
    const now = Date.now()
    const rec = store.get(key) || { count: 0, resetAt: now + windowMs }
    if (now > rec.resetAt) { rec.count = 1; rec.resetAt = now + windowMs }
    else rec.count++
    store.set(key, rec)
    return { ok: rec.count <= limit, remaining: Math.max(0, limit - rec.count), resetAt: Math.ceil(rec.resetAt / 1000) }
}

function checkInMemory(
    keyId: string,
    userId: string,
    targetPhone: string | null,
    limitPerMin: number
): RateLimitResult {
    const key = memCheck(stores.byKey, keyId, limitPerMin, 60_000)
    if (!key.ok) {
        return {
            allowed: false,
            reason: `Rate limit exceeded: ${limitPerMin} requests/minute per API key`,
            headers: { 'X-RateLimit-Limit': String(limitPerMin), 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(key.resetAt), 'Retry-After': '60' },
        }
    }

    const user = memCheck(stores.byUser, userId, 200, 60_000)
    if (!user.ok) {
        return {
            allowed: false,
            reason: 'Global rate limit exceeded: 200 requests/minute per account',
            headers: { 'X-RateLimit-Limit': '200', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(user.resetAt), 'Retry-After': '60' },
        }
    }

    if (targetPhone) {
        const phone = memCheck(stores.byPhone, targetPhone, 5, 24 * 60 * 60_000)
        if (!phone.ok) {
            return {
                allowed: false,
                reason: 'Anti-spam limit: max 5 messages per phone number per 24h',
                headers: { 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(phone.resetAt), 'Retry-After': '86400' },
            }
        }
    }

    return {
        allowed: true,
        headers: { 'X-RateLimit-Limit': String(limitPerMin), 'X-RateLimit-Remaining': String(key.remaining), 'X-RateLimit-Reset': String(key.resetAt) },
    }
}
