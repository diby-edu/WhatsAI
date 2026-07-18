import { NextRequest } from 'next/server'
import { errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

// POST /api/admin/bulk - Mass operations on users/resources
export async function POST(request: NextRequest) {
    const { user, adminSupabase, response } = await requireAdminAccess()
    if (response || !user || !adminSupabase) return response!

    try {
        const { action, ids, data } = await request.json()

        if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
            return errorResponse('Paramètres invalides (action, ids required)', 400)
        }

        const results = { success: 0, failed: 0 }

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
