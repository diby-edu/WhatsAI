/**
 * Rate limiting en mémoire pour l'API publique.
 * Trois niveaux : par clé API, par user_id, par numéro cible (anti-spam).
 */

interface RateRecord {
    count: number
    resetAt: number
}

const stores = {
    byKey: new Map<string, RateRecord>(),
    byUser: new Map<string, RateRecord>(),
    byPhone: new Map<string, RateRecord>(),  // compteur par numéro sur 24h
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

function check(store: Map<string, RateRecord>, key: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const rec = store.get(key) || { count: 0, resetAt: now + windowMs }

    if (now > rec.resetAt) {
        rec.count = 1
        rec.resetAt = now + windowMs
    } else {
        rec.count++
    }

    store.set(key, rec)
    return rec.count <= limit
}

function remaining(store: Map<string, RateRecord>, key: string, limit: number): number {
    const rec = store.get(key)
    if (!rec) return limit
    return Math.max(0, limit - rec.count)
}

function resetAt(store: Map<string, RateRecord>, key: string): number {
    return Math.ceil((store.get(key)?.resetAt ?? Date.now()) / 1000)
}

export interface RateLimitResult {
    allowed: boolean
    headers: Record<string, string>
    reason?: string
}

/**
 * Vérifie les 3 niveaux de rate limiting pour une requête API.
 */
export function checkPublicRateLimit(
    keyId: string,
    userId: string,
    targetPhone: string | null,
    limitPerMin: number
): RateLimitResult {
    // Niveau 1 : par clé API (ex: 60/min)
    const keyOk = check(stores.byKey, keyId, limitPerMin, 60_000)
    if (!keyOk) {
        return {
            allowed: false,
            reason: `Rate limit exceeded: ${limitPerMin} requests/minute per API key`,
            headers: {
                'X-RateLimit-Limit': String(limitPerMin),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(resetAt(stores.byKey, keyId)),
                'Retry-After': '60',
            }
        }
    }

    // Niveau 2 : par user (200/min global)
    const userOk = check(stores.byUser, userId, 200, 60_000)
    if (!userOk) {
        return {
            allowed: false,
            reason: 'Global rate limit exceeded: 200 requests/minute per account',
            headers: {
                'X-RateLimit-Limit': '200',
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(resetAt(stores.byUser, userId)),
                'Retry-After': '60',
            }
        }
    }

    // Niveau 3 : anti-spam par numéro cible (5 messages/24h)
    if (targetPhone) {
        const phoneOk = check(stores.byPhone, targetPhone, 5, 24 * 60 * 60_000)
        if (!phoneOk) {
            return {
                allowed: false,
                reason: 'Anti-spam limit: max 5 messages per phone number per 24h',
                headers: {
                    'X-RateLimit-Limit': '5',
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(resetAt(stores.byPhone, targetPhone)),
                    'Retry-After': String(86400),
                }
            }
        }
    }

    return {
        allowed: true,
        headers: {
            'X-RateLimit-Limit': String(limitPerMin),
            'X-RateLimit-Remaining': String(remaining(stores.byKey, keyId, limitPerMin)),
            'X-RateLimit-Reset': String(resetAt(stores.byKey, keyId)),
        }
    }
}
