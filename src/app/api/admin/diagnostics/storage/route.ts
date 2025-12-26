import { createApiClient, successResponse } from '@/lib/api-utils'

export async function GET() {
    const supabase = await createApiClient()

    try {
        const { data: buckets, error } = await supabase.storage.listBuckets()

        if (error) {
            return successResponse({ success: false, error: error.message })
        }

        return successResponse({
            success: true,
            buckets: buckets?.length || 0
        })
    } catch (err) {
        return successResponse({ success: false, error: 'Erreur de connexion au storage' })
    }
}
