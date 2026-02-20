import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/admin/notification-preferences - Get admin notification preferences
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Verify admin role via DB (secure)
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
        const { data, error } = await adminSupabase
            .from('admin_notification_preferences')
            .select('*')
            .eq('admin_id', user.id)
            .single()

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching admin notification preferences:', error)
            return errorResponse('Erreur lors de la récupération des préférences', 500)
        }

        // Return defaults if no preferences exist
        const preferences = data || {
            // Users & Revenue
            notif_new_user: true,
            notif_plan_upgrade: true,
            notif_plan_downgrade: true,
            notif_payment_received: true,
            notif_payment_failed: true,
            notif_subscription_cancelled: true,
            // Agents
            notif_agent_created: true,
            notif_agent_connected: true,
            notif_agent_disconnected: true,
            notif_agent_quota_exceeded: true,
            // System
            notif_openai_error: true,
            notif_whatsapp_down: true,
            notif_high_error_rate: true,
            // Activity
            notif_new_conversation: false,
            notif_new_order: true,
            notif_escalation: true
        }

        return successResponse({ preferences })
    } catch (err) {
        console.error('Admin notification preferences API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// PATCH /api/admin/notification-preferences - Update admin notification preferences
export async function PATCH(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Verify admin role via DB (secure)
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
        const body = await request.json()

        // Upsert preferences
        const { data, error } = await adminSupabase
            .from('admin_notification_preferences')
            .upsert({
                admin_id: user.id,
                ...body,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'admin_id'
            })
            .select()
            .single()

        if (error) {
            console.error('Error updating admin notification preferences:', error)
            return errorResponse('Erreur lors de la mise à jour des préférences', 500)
        }

        return successResponse({ preferences: data })
    } catch (err) {
        console.error('Admin notification preferences PATCH error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
