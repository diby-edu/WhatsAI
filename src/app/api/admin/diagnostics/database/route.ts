import { createApiClient, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET() {
    const supabase = await createApiClient()

    try {
        const start = Date.now()
        const { error } = await supabase.from('profiles').select('id').limit(1)
        const latency = Date.now() - start

        if (error) {
            return successResponse({ success: false, error: error.message, latency })
        }

        return successResponse({ success: true, latency })
    } catch (err) {
        return successResponse({ success: false, error: 'Connexion échouée' })
    }
}
