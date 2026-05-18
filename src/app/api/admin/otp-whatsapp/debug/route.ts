import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { withAdminAuth, successResponse, errorResponse } from '@/lib/api-utils'
import { NextRequest } from 'next/server'

export const GET = withAdminAuth(async (_req: NextRequest) => {
    try {
        const serviceClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data, error } = await serviceClient
            .from('agents')
            .select('id, name, whatsapp_connected, whatsapp_status, whatsapp_phone')
            .eq('name', '__otp_sender__')
            .single()

        return successResponse({
            found: !!data,
            error: error?.message,
            agent: data ? {
                id: data.id,
                name: data.name,
                whatsapp_connected: data.whatsapp_connected,
                whatsapp_status: data.whatsapp_status,
                whatsapp_phone: data.whatsapp_phone,
                isReady: data.whatsapp_connected || data.whatsapp_status === 'connected',
            } : null,
        })
    } catch (err: any) {
        return errorResponse(err.message, 500)
    }
})

// POST — réinitialiser le rate limit OTP pour un numéro
export const POST = withAdminAuth(async (req: NextRequest) => {
    const { phone } = await req.json().catch(() => ({}))
    if (!phone) return errorResponse('phone requis', 400)

    try {
        const redis = Redis.fromEnv()
        const cleaned = phone.replace(/^\+/, '')
        const keys = [`otp_limit:+${cleaned}`, `otp_limit:${cleaned}`]
        await Promise.all(keys.map((k: string) => redis.del(k)))
        return successResponse({ reset: true, phone })
    } catch (err: any) {
        return errorResponse(err.message, 500)
    }
})
