import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { getUserIdsForBroadcastSegment } from '@/lib/admin/broadcast-segments'
import { sendPushNotificationToMultiple } from '@/lib/notifications/firebase-admin'

export const dynamic = 'force-dynamic'

async function adminCheck() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return { error: errorResponse('Non autorisé', 401), user: null, adminSupabase: null }
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') return { error: errorResponse('Accès refusé', 403), user: null, adminSupabase: null }
    return { error: null, user, adminSupabase }
}

async function getTokensForSegment(adminSupabase: any, targetSegment: string): Promise<string[]> {
    const userIds = await getUserIdsForBroadcastSegment(adminSupabase, targetSegment)
    if (userIds.length === 0) return []

    const { data, error } = await adminSupabase
        .from('device_tokens')
        .select('token')
        .in('user_id', userIds)
    if (error) throw error
    return (data || []).map((row: any) => row.token).filter(Boolean)
}

// GET — preview device count AND total user count for a plan segment
export async function GET(request: NextRequest) {
    const { error, adminSupabase } = await adminCheck()
    if (error || !adminSupabase) return error!

    const { searchParams } = new URL(request.url)
    const targetSegment = searchParams.get('targetSegment') || searchParams.get('targetPlan') || 'all'

    try {
        const [tokens, userIds] = await Promise.all([
            getTokensForSegment(adminSupabase, targetSegment),
            getUserIdsForBroadcastSegment(adminSupabase, targetSegment)
        ])
        return successResponse({ count: tokens.length, userCount: userIds.length })
    } catch (err) {
        console.error('Push preview error:', err)
        return successResponse({ count: 0, userCount: 0 })
    }
}

// POST — send push notification broadcast
export async function POST(request: NextRequest) {
    const { error, user, adminSupabase } = await adminCheck()
    if (error || !adminSupabase) return error!

    try {
        const { title, body, targetSegment, targetPlan, targetUserIds } = await request.json()
        const resolvedSegment = targetSegment || targetPlan || 'all'

        if (!title?.trim() || !body?.trim()) {
            return errorResponse('Titre et message requis', 400)
        }

        const isIndividual = Array.isArray(targetUserIds) && targetUserIds.length > 0

        // Fetch device tokens
        let tokens: string[] = []
        if (isIndividual) {
            const { data } = await adminSupabase
                .from('device_tokens')
                .select('token')
                .in('user_id', targetUserIds)
            tokens = (data || []).map((row: any) => row.token).filter(Boolean)
        } else {
            tokens = await getTokensForSegment(adminSupabase, resolvedSegment)
        }

        // Send FCM push only if there are registered devices
        let sent = 0
        let failed = 0
        let failedEmails: string[] = []
        if (tokens.length > 0) {
            const result = await sendPushNotificationToMultiple(tokens, {
                title: title.trim(),
                body: body.trim(),
                data: { type: 'admin_broadcast', route: '/dashboard' }
            })
            sent = result?.success ?? 0
            failed = result?.failure ?? 0

            // Resolve failed tokens to user emails for admin retry
            if ((result?.invalidTokens ?? []).length > 0) {
                try {
                    const { data: failedRows } = await adminSupabase
                        .from('device_tokens')
                        .select('user_id')
                        .in('token', result.invalidTokens)
                    const failedUserIds = (failedRows || []).map((r: any) => r.user_id).filter(Boolean)
                    if (failedUserIds.length > 0) {
                        const { data: failedProfiles } = await adminSupabase
                            .from('profiles')
                            .select('email')
                            .in('id', failedUserIds)
                        failedEmails = (failedProfiles || []).map((p: any) => p.email).filter(Boolean)
                    }
                } catch { /* non-bloquant */ }
            }
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
            const userIds = isIndividual ? targetUserIds : await getUserIdsForBroadcastSegment(adminSupabase, resolvedSegment)
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

        // Log to broadcasts table après calcul userCount (push + cloche)
        try {
            await adminSupabase.from('broadcasts').insert({
                agent_id: null,
                user_id: user!.id,
                message: `[PUSH] ${title.trim()}`,
                recipients_count: Math.max(sent, userCount),
                status: 'sent',
                created_at: new Date().toISOString()
            })
        } catch { /* log failure is non-blocking */ }

        return successResponse({ sent, failed, total: tokens.length, userCount, failedEmails })
    } catch (err) {
        console.error('Push broadcast error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
