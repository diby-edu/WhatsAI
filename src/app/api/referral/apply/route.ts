import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { createPendingReferral } from '@/lib/referral'

export const dynamic = 'force-dynamic'

// POST /api/referral/apply — Attache un parrain à l'utilisateur connecté
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const body = await request.json().catch(() => ({}))
    const refCode = body?.ref_code as string | undefined

    if (!refCode || typeof refCode !== 'string' || refCode.trim().length === 0) {
        return errorResponse('Code parrain manquant', 400)
    }

    try {
        await createPendingReferral(user.id, refCode)
        return successResponse({ message: 'Parrainage enregistré' })
    } catch (err) {
        console.error('[REFERRAL] apply error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// GET /api/referral/apply — Infos parrainage de l'utilisateur connecté
export async function GET(_request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Non autorisé', 401)

    const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single()

    const { data: referrals } = await supabase
        .from('referrals')
        .select('status, created_at')
        .eq('referrer_id', user.id)

    const confirmed = (referrals || []).filter(r => r.status === 'confirmed').length
    const pending = (referrals || []).filter(r => r.status === 'pending').length
    const creditsEarned = confirmed * 10

    return successResponse({
        referral_code: profile?.referral_code || null,
        total_referrals: (referrals || []).length,
        confirmed,
        pending,
        credits_earned: creditsEarned,
    })
}
