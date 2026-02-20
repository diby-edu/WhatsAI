import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'

// POST /api/admin/bulk - Mass operations on users/resources
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Secure role verification
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { action, ids, data } = await request.json()

        if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
            return errorResponse('Paramètres invalides (action, ids required)', 400)
        }

        let results = { success: 0, failed: 0 }

        switch (action) {
            case 'bulk_ban':
                const { error: banErr } = await adminSupabase
                    .from('profiles')
                    .update({ is_active: false })
                    .in('id', ids)

                if (banErr) throw banErr
                results.success = ids.length
                await logAdminAction(user.id, 'bulk_ban_users', undefined, 'profile', { count: ids.length, ids })
                break;

            case 'bulk_unban':
                const { error: unbanErr } = await adminSupabase
                    .from('profiles')
                    .update({ is_active: true })
                    .in('id', ids)

                if (unbanErr) throw unbanErr
                results.success = ids.length
                await logAdminAction(user.id, 'bulk_unban_users', undefined, 'profile', { count: ids.length, ids })
                break;

            case 'bulk_change_role':
                if (!data?.role) return errorResponse('Role manquant', 400)
                const { error: roleErr } = await adminSupabase
                    .from('profiles')
                    .update({ role: data.role })
                    .in('id', ids)

                if (roleErr) throw roleErr
                results.success = ids.length
                await logAdminAction(user.id, 'bulk_change_role', undefined, 'profile', { count: ids.length, ids, role: data.role })
                break;

            default:
                return errorResponse('Action bulk inconnue', 400)
        }

        return successResponse({ results })
    } catch (err: any) {
        console.error('Bulk API error:', err)
        return errorResponse(err.message, 500)
    }
}
