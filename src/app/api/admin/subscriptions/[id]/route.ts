import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// PATCH /api/admin/subscriptions/[id] — Update user subscription (plan, credits, cancel)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

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
        const { id } = await params
        const body = await request.json()
        const { action, plan, credits } = body

        if (action === 'change_plan') {
            if (!plan) return errorResponse('Plan requis', 400)
            const validPlans = ['free', 'starter', 'pro', 'business']
            if (!validPlans.includes(plan)) return errorResponse('Plan invalide', 400)

            const { error } = await adminSupabase
                .from('profiles')
                .update({ plan, subscription_plan: plan })
                .eq('id', id)

            if (error) throw error
            return successResponse({ message: `Plan changé en ${plan}` })
        }

        if (action === 'cancel') {
            const { error } = await adminSupabase
                .from('profiles')
                .update({ plan: 'free', subscription_plan: 'Free' })
                .eq('id', id)

            if (error) throw error
            return successResponse({ message: 'Abonnement annulé (rétrogradé en Free)' })
        }

        if (action === 'set_credits') {
            if (credits === undefined) return errorResponse('Crédits requis', 400)
            const { error } = await adminSupabase
                .from('profiles')
                .update({ credits_balance: Number(credits) })
                .eq('id', id)

            if (error) throw error
            return successResponse({ message: `Crédits définis à ${credits}` })
        }

        return errorResponse('Action invalide', 400)
    } catch (err) {
        console.error('Update subscription error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
