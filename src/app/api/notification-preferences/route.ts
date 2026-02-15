import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/notification-preferences - Get current user notification preferences
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    // Try to get existing preferences
    let { data: preferences, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .single()

    // If no preferences exist, create default ones
    if (error && error.code === 'PGRST116') {
        const { data: newPrefs, error: insertError } = await supabase
            .from('notification_preferences')
            .insert({ user_id: user!.id })
            .select()
            .single()

        if (insertError) {
            return errorResponse('Impossible de créer les préférences', 500)
        }

        preferences = newPrefs
    } else if (error) {
        return errorResponse('Préférences non trouvées', 404)
    }

    return successResponse({ preferences })
}

// PATCH /api/notification-preferences - Update current user notification preferences
export async function PATCH(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()

        // Only allow specific fields to be updated
        const allowedFields = [
            'email_new_conversation',
            'email_daily_summary',
            'email_low_credits',
            'email_new_order',
            'email_agent_status_change',
            'push_enabled',
            'push_new_conversation',
            'push_new_order',
            'push_low_credits',
            'push_agent_status_change'
        ]

        const updates: Record<string, any> = {}
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field]
            }
        }

        updates.updated_at = new Date().toISOString()

        // Try to update, if not exists, create (upsert)
        const { data: preferences, error } = await supabase
            .from('notification_preferences')
            .upsert({
                user_id: user!.id,
                ...updates
            }, {
                onConflict: 'user_id'
            })
            .select()
            .single()

        if (error) {
            console.error('Error updating notification preferences:', error)
            return errorResponse('Mise à jour échouée', 500)
        }

        return successResponse({ preferences })
    } catch (err) {
        return errorResponse('Données invalides', 400)
    }
}
