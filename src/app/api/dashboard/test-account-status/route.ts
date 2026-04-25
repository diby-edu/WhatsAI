import { createAdminClient, createApiClient, errorResponse, getAuthUser, successResponse } from '@/lib/api-utils'
import { TEST_ACCOUNT_GRACE_DAYS, fetchUserTestAccountState } from '@/lib/test-account'
import { ACCOUNT_PAID_GRACE_DAYS } from '@/lib/account-lifecycle'

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

        // Vérifie si l'utilisateur a des crédits non utilisés (pour adapter le message du banner)
        let hasUnusedCredits = false
        if (state.isTestAccount || isPaidBanner) {
            const { data: profileData } = await adminSupabase
                .from('profiles')
                .select('credits_balance')
                .eq('id', user.id)
                .single()
            hasUnusedCredits = Number(profileData?.credits_balance || 0) > 0
        }

        // Compte test entré en frozen_grace via achat de crédits (jamais eu d'abonnement)
        // paid_until null = jamais souscrit
        const isTestGraceMode = bannerMode === 'paid_grace'
            && !state.lifecycleAccess?.lifecycle.paidUntil

        return successResponse({
            bannerMode,
            isTestAccount: state.isTestAccount,
            showCountdown,
            isExpired: state.isExpired,
            isExpiredSubscriber: isPaidBanner && !isTestGraceMode,
            cleanupDeadline: bannerDeadline,
            remainingMs,
            graceDays: isPaidBanner && !isTestGraceMode
                ? ACCOUNT_PAID_GRACE_DAYS
                : TEST_ACCOUNT_GRACE_DAYS,
            exitReason: state.exitReason,
            lifecycleStatus: state.lifecycleAccess?.lifecycle.status || 'inactive',
            hasUnusedCredits,
            isTestGraceMode,
        })
    } catch (err) {
        console.error('Test account status API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
