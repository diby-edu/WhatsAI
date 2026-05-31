import { successResponse, errorResponse, createAdminClient, withAdminAuth } from '@/lib/api-utils'
import { DEFAULT_ENABLED_PLATFORMS } from '@/lib/admin/settings'

export const GET = withAdminAuth(async () => {
    const adminSupabase = createAdminClient()
    const { data } = await adminSupabase
        .from('app_settings')
        .select('value')
        .eq('key', 'enabled_platforms')
        .maybeSingle()

    let enabledPlatforms = DEFAULT_ENABLED_PLATFORMS
    if (data?.value) {
        try { enabledPlatforms = JSON.parse(data.value) } catch { /* use default */ }
    }

    return successResponse({ enabledPlatforms })
})

export const PATCH = withAdminAuth(async (request) => {
    try {
        const { enabledPlatforms } = await request.json()
        if (!Array.isArray(enabledPlatforms)) return errorResponse('enabledPlatforms doit être un tableau', 400)

        const adminSupabase = createAdminClient()
        await adminSupabase.from('app_settings').upsert(
            { key: 'enabled_platforms', value: JSON.stringify(enabledPlatforms) },
            { onConflict: 'key' }
        )

        return successResponse({ enabledPlatforms })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
})
