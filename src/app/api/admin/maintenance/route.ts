import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { setMaintenanceMode } from '@/lib/admin/settings'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { data: flag } = await adminSupabase
            .from('feature_flags')
            .select('enabled')
            .eq('key', 'maintenance_mode')
            .single()

        const { data: setting } = await adminSupabase
            .from('app_settings')
            .select('value')
            .eq('key', 'maintenance_paused_agents')
            .maybeSingle()

        return successResponse({
            maintenance: flag?.enabled ?? false,
            pausedCount: (setting?.value as any)?.ids?.length ?? 0,
        })
    } catch (err) {
        console.error('Maintenance GET error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

export async function POST(request: NextRequest) {
    const { response, user, adminSupabase } = await requireAdminAccess()
    if (response || !user || !adminSupabase) return response!

    try {
        const { action } = await request.json()

        if (action === 'activate') {
            const result = await setMaintenanceMode(adminSupabase, user.id, true)
            return successResponse({ pausedCount: result.affectedAgents })
        }

        if (action === 'deactivate') {
            const result = await setMaintenanceMode(adminSupabase, user.id, false)
            return successResponse({ restoredCount: result.affectedAgents })
        }

        return errorResponse('Action invalide', 400)
    } catch (err) {
        console.error('Maintenance POST error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
