import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

async function adminCheck(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return { error: errorResponse('Non autorisé', 401), user: null, adminSupabase: null }
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return { error: errorResponse('Accès refusé', 403), user: null, adminSupabase: null }
    return { error: null, user, adminSupabase }
}

// GET — Returns { maintenance: boolean, pausedCount: number }
export async function GET(request: NextRequest) {
    const { error, adminSupabase } = await adminCheck(request)
    if (error || !adminSupabase) return error!

    try {
        // Read maintenance_mode from feature_flags
        const { data: flag } = await adminSupabase
            .from('feature_flags')
            .select('enabled')
            .eq('key', 'maintenance_mode')
            .single()

        const maintenance = flag?.enabled ?? false

        // Read paused agents count from admin_settings
        const { data: setting } = await adminSupabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'maintenance_paused_agents')
            .single()

        const pausedCount = (setting?.value as any)?.ids?.length ?? 0

        return successResponse({ maintenance, pausedCount })
    } catch (err) {
        console.error('Maintenance GET error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST — { action: 'activate' | 'deactivate' }
export async function POST(request: NextRequest) {
    const { error, user, adminSupabase } = await adminCheck(request)
    if (error || !adminSupabase) return error!

    try {
        const { action } = await request.json()

        if (action === 'activate') {
            // 1. Get all currently active agents
            const { data: activeAgents, error: agentsError } = await adminSupabase
                .from('agents')
                .select('id')
                .eq('is_active', true)

            if (agentsError) throw agentsError

            const agentIds = (activeAgents || []).map((a: any) => a.id)

            // 2. Store their IDs in admin_settings
            await adminSupabase
                .from('admin_settings')
                .upsert({
                    key: 'maintenance_paused_agents',
                    value: { ids: agentIds },
                    description: 'Agents paused by maintenance mode',
                    updated_by: user!.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })

            // 3. Pause all active agents
            if (agentIds.length > 0) {
                const { error: updateError } = await adminSupabase
                    .from('agents')
                    .update({ is_active: false })
                    .in('id', agentIds)

                if (updateError) throw updateError
            }

            // 4. Set maintenance_mode = true
            await adminSupabase
                .from('feature_flags')
                .upsert({
                    key: 'maintenance_mode',
                    enabled: true,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })

            return successResponse({ pausedCount: agentIds.length })
        }

        if (action === 'deactivate') {
            // 1. Read stored agent IDs
            const { data: setting } = await adminSupabase
                .from('admin_settings')
                .select('value')
                .eq('key', 'maintenance_paused_agents')
                .single()

            const ids: string[] = (setting?.value as any)?.ids ?? []

            // 2. Restore those agents
            if (ids.length > 0) {
                const { error: updateError } = await adminSupabase
                    .from('agents')
                    .update({ is_active: true })
                    .in('id', ids)

                if (updateError) throw updateError
            }

            // 3. Clear stored IDs
            await adminSupabase
                .from('admin_settings')
                .upsert({
                    key: 'maintenance_paused_agents',
                    value: { ids: [] },
                    description: 'Agents paused by maintenance mode',
                    updated_by: user!.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })

            // 4. Set maintenance_mode = false
            await adminSupabase
                .from('feature_flags')
                .upsert({
                    key: 'maintenance_mode',
                    enabled: false,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })

            return successResponse({ restoredCount: ids.length })
        }

        return errorResponse('Action invalide', 400)
    } catch (err) {
        console.error('Maintenance POST error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
