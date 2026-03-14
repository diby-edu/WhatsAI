import { successResponse, errorResponse, createAdminClient } from '@/lib/api-utils'
import { getPublicRuntimeConfig } from '@/lib/admin/settings'

export async function GET() {
    try {
        const adminSupabase = createAdminClient()
        const config = await getPublicRuntimeConfig(adminSupabase)
        return successResponse(config)
    } catch (err: any) {
        console.error('Runtime config error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
