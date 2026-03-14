import { createApiClient, errorResponse, getAuthUser, successResponse } from '@/lib/api-utils'
import { maybeNotifyNewUserOnce } from '@/lib/auth/new-user-notify'

export async function POST() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse(authError || 'Non autorise', 401)
    }

    const notified = await maybeNotifyNewUserOnce({
        userId: user.id,
        userEmail: user.email,
        userName: user.user_metadata?.full_name || user.user_metadata?.name || null,
    })

    return successResponse({ notified })
}
