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
    let query = adminSupabase
        .from('device_tokens')
        .select('token, profiles!inner(plan)')

    if (targetPlan && targetPlan !== 'all') {
        query = query.eq('profiles.plan', targetPlan)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []).map((row: any) => row.token).filter(Boolean)
}

// GET — preview device count for a plan segment
export async function GET(request: NextRequest) {
    const { error, adminSupabase } = await adminCheck(request)
    if (error || !adminSupabase) return error!

    const { searchParams } = new URL(request.url)
    const targetPlan = searchParams.get('targetPlan') || 'all'

    try {
        const tokens = await getTokensForPlan(adminSupabase, targetPlan)
        return successResponse({ count: tokens.length })
    } catch (err) {
        console.error('Push preview error:', err)
        return successResponse({ count: 0 })
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

        if (tokens.length === 0) {
            return errorResponse('Aucun appareil enregistré pour ce segment', 400)
        }

        // Send via Firebase (batches of 500 handled internally)
        const result = await sendPushNotificationToMultiple(tokens, {
            title: title.trim(),
            body: body.trim(),
            data: { type: 'admin_broadcast', route: '/dashboard' }
        })

        const sent = result?.successCount ?? tokens.length
        const failed = result?.failureCount ?? 0

        // Log to broadcasts table
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

        return successResponse({ sent, failed, total: tokens.length })
    } catch (err) {
        console.error('Push broadcast error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
