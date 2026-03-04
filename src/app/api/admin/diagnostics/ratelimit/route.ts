import { createApiClient, getAuthUser, successResponse, errorResponse } from '@/lib/api-utils'
import { NextRequest } from 'next/server'

import { checkRateLimit } from '@/lib/rate-limit'
import { Redis } from '@upstash/redis'

export async function GET(request: NextRequest) {
    const supabaseSecClient = await createApiClient()
    const { user: secUser, error: secAuthError } = await getAuthUser(supabaseSecClient)
    if (secAuthError || secUser?.role !== 'admin') {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    try {
        const results: any = {
            message: 'Diagnostic Rate Limit (Redis)',
            timestamp: new Date().toISOString(),
            config_detected: false,
            redis_ping: 'unknown',
            rate_limit_test: 'unknown'
        }

        const redisUrl = process.env.UPSTASH_REDIS_REST_URL
        const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

        if (redisUrl && redisToken) {
            results.config_detected = true

            // 1. Test ping
            try {
                const redis = Redis.fromEnv()
                const ping = await redis.ping()
                results.redis_ping = ping === 'PONG' ? 'success' : `unexpected: ${ping}`
            } catch (pingError: any) {
                results.redis_ping = `failed: ${pingError.message}`
            }

            // 2. Test Rate Limit logic
            try {
                const limitResult = await checkRateLimit('diagnostic-test', { windowMs: 10000, maxRequests: 5 })
                results.rate_limit_test = {
                    success: limitResult.success,
                    remaining: limitResult.remaining,
                    reset_in_ms: limitResult.resetTime - Date.now()
                }
            } catch (limitError: any) {
                results.rate_limit_test = `failed: ${limitError.message}`
            }

        } else {
            results.config_detected = false
            results.message = 'Redis creds missing in env'
        }

        return successResponse(results)
    } catch (error: any) {
        return errorResponse(error.message, 500)
    }
}
