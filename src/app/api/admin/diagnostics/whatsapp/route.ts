import { createApiClient, getAuthUser } from '@/lib/api-utils'
import { createApiClient, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET() {
    const supabaseSecClient = await createApiClient()
    const { user: secUser, error: secAuthError } = await getAuthUser(supabaseSecClient)
    if (secAuthError || secUser?.role !== 'admin') {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    const supabase = await createApiClient()

    try {
        const { count: total } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })

        const { count: connected } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('whatsapp_connected', true)

        return successResponse({
            total: total || 0,
            connected: connected || 0
        })
    } catch (err) {
        return successResponse({ total: 0, connected: 0 })
    }
}
