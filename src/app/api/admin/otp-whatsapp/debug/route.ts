import { createClient } from '@supabase/supabase-js'
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
