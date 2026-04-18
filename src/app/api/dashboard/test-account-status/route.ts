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
                bannerMode: null,
                isTestAccount: false,
                showCountdown: false,
                isExpired: false,
                isExpiredSubscriber: false,
                cleanupDeadline: null,
                remainingMs: null,
                graceDays: TEST_ACCOUNT_GRACE_DAYS,
            })
        }

        const bannerMode = state.lifecycleAccess?.bannerMode || null
        const isPaidBanner = bannerMode === 'paid_grace' || bannerMode === 'paid_expired'
        const bannerDeadline = isPaidBanner
            ? (state.lifecycleAccess?.lifecycle.graceUntil || null)
            : state.cleanupDeadline
        const showCountdown = bannerMode === 'paid_grace'
            ? true
            : state.showCountdown
        const remainingMs = bannerMode === 'paid_grace'
            ? state.lifecycleAccess?.lifecycle.remainingGraceMs ?? null
            : state.remainingMs

        return successResponse({
            bannerMode,
            isTestAccount: state.isTestAccount,
            showCountdown,
            isExpired: state.isExpired,
            isExpiredSubscriber: isPaidBanner,
            cleanupDeadline: bannerDeadline,
            remainingMs,
            graceDays: TEST_ACCOUNT_GRACE_DAYS,
            exitReason: state.exitReason,
            lifecycleStatus: state.lifecycleAccess?.lifecycle.status || 'inactive',
        })
    } catch (err) {
        console.error('Test account status API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
