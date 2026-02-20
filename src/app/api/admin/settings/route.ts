import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'

// GET /api/admin/settings - Get all application settings
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    const adminSupabase = createAdminClient()

    // Check admin role
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { data, error } = await adminSupabase
            .from('app_settings')
            .select('*')

        if (error) throw error

        // Transform into key-value object
        const settings = data.reduce((acc: any, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        return successResponse({ settings })
    } catch (err: any) {
        console.error('Settings API error:', err)
        return errorResponse(err.message, 500)
    }
}

// PATCH /api/admin/settings - Update specific settings
export async function PATCH(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    const adminSupabase = createAdminClient()

    // Check admin
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const updates = await request.json()

        for (const [key, value] of Object.entries(updates)) {
            const { error } = await adminSupabase
                .from('app_settings')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString(),
                    updated_by: user.id
                })

            if (error) throw error
        }

        await logAdminAction(user.id, 'update_settings', undefined, 'system', { keys: Object.keys(updates) })

        return successResponse({ success: true })
    } catch (err: any) {
        console.error('Settings update error:', err)
        return errorResponse(err.message, 500)
    }
}
