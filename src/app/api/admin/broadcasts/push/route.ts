import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { sendPushNotificationToMultiple } from '@/lib/notifications/firebase-admin'

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

async function getTokensForPlan(adminSupabase: any, targetPlan: string): Promise<string[]> {
    // Step 1: get user IDs for the target plan
    const userIds = await getUserIdsForPlan(adminSupabase, targetPlan)
    if (userIds.length === 0) return []

    // Step 2: get tokens for those users
    const { data, error } = await adminSupabase
        .from('device_tokens')
        .select('token')
        .in('user_id', userIds)
    if (error) throw error
    return (data || []).map((row: any) => row.token).filter(Boolean)
}

async function getUserIdsForPlan(adminSupabase: any, targetPlan: string): Promise<string[]> {
    let query = adminSupabase.from('profiles').select('id')
    if (targetPlan && targetPlan !== 'all') {
        query = query.eq('plan', targetPlan)
    }
    const { data } = await query
    return (data || []).map((row: any) => row.id).filter(Boolean)
}

// GET — preview device count AND total user count for a plan segment
export async function GET(request: NextRequest) {
    const { error, adminSupabase } = await adminCheck(request)
    if (error || !adminSupabase) return error!

    const { searchParams } = new URL(request.url)
    const targetPlan = searchParams.get('targetPlan') || 'all'

    try {
        const [tokens, userIds] = await Promise.all([
            getTokensForPlan(adminSupabase, targetPlan),
            getUserIdsForPlan(adminSupabase, targetPlan)
        ])
        return successResponse({ count: tokens.length, userCount: userIds.length })
    } catch (err) {
        console.error('Push preview error:', err)
        return successResponse({ count: 0, userCount: 0 })
    }
}

// POST — send push notification broadcast
export async function POST(request: NextRequest) {
    const { error, user, adminSupabase } = await adminCheck(request)
    if (error || !adminSupabase) return error!

    try {
        const { title, body, targetPlan } = await request.json()

        if (!title?.trim() || !body?.trim()) {
            return errorResponse('Titre et message requis', 400)
        }

        // Fetch all device tokens — bypass notification preferences
        const tokens = await getTokensForPlan(adminSupabase, targetPlan || 'all')

        // Send FCM push only if there are registered devices
        let sent = 0
        let failed = 0
        if (tokens.length > 0) {
            const result = await sendPushNotificationToMultiple(tokens, {
                title: title.trim(),
                body: body.trim(),
                data: { type: 'admin_broadcast', route: '/dashboard' }
            })
            sent = result?.success ?? 0
            failed = result?.failure ?? 0

            // Log to broadcasts table (historique admin permanent — jamais supprimé)
            try {
                await adminSupabase.from('broadcasts').insert({
                    agent_id: null,
                    user_id: user!.id,
                    message: `[PUSH] ${title.trim()}`,
                    recipients_count: sent,
                    status: 'sent',
                    created_at: new Date().toISOString()
                })
            } catch { /* log failure is non-blocking */ }
        }

        // Insérer dans notification_log pour la cloche — pour TOUS les users du segment
        let userCount = 0
        try {
            // Purge des entrées > 30 jours
            await adminSupabase
                .from('notification_log')
                .delete()
                .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

            // Batch insert pour tous les utilisateurs du segment
            const userIds = await getUserIdsForPlan(adminSupabase, targetPlan || 'all')
            userCount = userIds.length
            if (userIds.length > 0) {
                const rows = userIds.map((uid: string) => ({
                    user_id: uid,
                    type: 'broadcast_push',
                    data: { title: title.trim(), body: body.trim() }
                }))
                await adminSupabase.from('notification_log').insert(rows)
            }
        } catch { /* non-bloquant */ }

        return successResponse({ sent, failed, total: tokens.length, userCount })
    } catch (err) {
        console.error('Push broadcast error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
