import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
    const { response } = await requireAdminAccess()
    if (response) return response

    try {
        const results: any = {
            checked_at: new Date().toISOString(),
            openai: {
                status: process.env.OPENAI_API_KEY ? 'ok' : 'warning',
                message: process.env.OPENAI_API_KEY ? 'Cle detectee' : 'OPENAI_API_KEY absente',
                details: `Limite AI: ${RATE_LIMITS.ai.maxRequests}/min`,
            },
            cinetpay: {
                status: process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID ? 'ok' : 'warning',
                message: process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID ? 'Configuration detectee' : 'Configuration incomplete',
                details: `Limite paiements: ${RATE_LIMITS.payment.maxRequests}/min`,
            },
            supabase: {
                status: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'ok' : 'error',
                message: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configuration detectee' : 'Configuration incomplete',
                details: `Limite API: ${RATE_LIMITS.api.maxRequests}/min`,
            },
            redis: {
                configured: false,
                ping: 'unknown',
                test: null as any,
            },
        }

        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            results.redis.configured = true
            try {
                const redis = Redis.fromEnv()
                const ping = await redis.ping()
                results.redis.ping = ping === 'PONG' ? 'success' : String(ping)
            } catch (err: any) {
                results.redis.ping = `failed: ${err.message}`
            }

            try {
                const testResult = await checkRateLimit('diagnostic-test', { windowMs: 10000, maxRequests: 5 })
                results.redis.test = {
                    success: testResult.success,
                    remaining: testResult.remaining,
                    reset_in_ms: testResult.resetTime - Date.now(),
                }
            } catch (err: any) {
                results.redis.test = { error: err.message }
            }
        }

        return successResponse(results)
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
