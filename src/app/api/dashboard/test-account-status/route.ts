import { createAdminClient, createApiClient, errorResponse, getAuthUser, successResponse } from '@/lib/api-utils'
import { TEST_ACCOUNT_GRACE_DAYS, fetchUserTestAccountState } from '@/lib/test-account'

export const dynamic = 'force-dynamic'

export async function GET() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse(authError || 'Non autorise', 401)
    }

    try {
        const adminSupabase = createAdminClient()
        const state = await fetchUserTestAccountState(adminSupabase, user.id)

        if (!state) {
            return successResponse({
                isTestAccount: false,
                showCountdown: false,
                isExpired: false,
                cleanupDeadline: null,
                remainingMs: null,
                graceDays: TEST_ACCOUNT_GRACE_DAYS,
            })
        }

        return successResponse({
            isTestAccount: state.isTestAccount,
            showCountdown: state.showCountdown,
            isExpired: state.isExpired,
            cleanupDeadline: state.cleanupDeadline,
            remainingMs: state.remainingMs,
            graceDays: TEST_ACCOUNT_GRACE_DAYS,
            exitReason: state.exitReason,
        })
    } catch (err) {
        console.error('Test account status API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
