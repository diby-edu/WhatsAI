import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { initializeMessageHandler } from '@/lib/whatsapp/message-handler'

export async function GET(request: NextRequest) {
    return POST(request)
}

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || user?.user_metadata?.role !== 'admin') {
        return errorResponse('Unauthorized', 401)
    }

    try {
        console.log('🔄 Manually initializing WhatsApp Message Handler...')
        initializeMessageHandler()
        console.log('✅ WhatsApp Message Handler initialized manually.')

        return successResponse({
            success: true,
            message: 'WhatsApp Brain initialized manually 🧠',
        })
    } catch (error) {
        console.error('Failed to initialize:', error)
        return errorResponse('Failed to initialize', 500)
    }
}
