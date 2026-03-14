import { NextRequest } from 'next/server'
import { errorResponse, logAdminAction, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { loadAdminSettings, saveAdminSettings } from '@/lib/admin/settings'

export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const settings = await loadAdminSettings(adminSupabase)
        return successResponse({ settings })
    } catch (err: any) {
        console.error('Settings API error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}

export async function PATCH(request: NextRequest) {
    const { response, user, adminSupabase } = await requireAdminAccess()
    if (response || !user || !adminSupabase) return response!

    try {
        const updates = await request.json()
        const updatedKeys = await saveAdminSettings(adminSupabase, user.id, updates)

        await logAdminAction(user.id, 'update_settings', undefined, 'system', { keys: updatedKeys })

        return successResponse({ success: true, updatedKeys })
    } catch (err: any) {
        console.error('Settings update error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
