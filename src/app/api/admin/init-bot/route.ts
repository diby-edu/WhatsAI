import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { initializeMessageHandler } from '@/lib/whatsapp/message-handler'

export async function GET(request: NextRequest) {
    return POST(request)
}

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Verify admin role via DB (secure)
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
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
