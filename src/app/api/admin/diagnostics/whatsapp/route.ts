import { createApiClient, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET() {
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
