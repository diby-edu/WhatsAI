import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'
import { notifyAdmins } from '@/lib/notifications/admin-notify'

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

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
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

            // Get current plan to determine upgrade vs downgrade
            const { data: targetProfile } = await adminSupabase
                .from('profiles')
                .select('plan, email')
                .eq('id', id)
                .single()

            const { error } = await adminSupabase
                .from('profiles')
                .update({ plan, subscription_plan: plan })
                .eq('id', id)

            if (error) throw error
            await logAdminAction(user.id, 'change_subscription_plan', id, 'profile', { plan })

            // Notify admins of plan change
            const planOrder = ['free', 'starter', 'pro', 'business']
            const previousPlan = targetProfile?.plan || 'free'
            const isUpgrade = planOrder.indexOf(plan) > planOrder.indexOf(previousPlan)
            notifyAdmins(isUpgrade ? 'plan_upgrade' : 'plan_downgrade', {
                userId: id,
                userEmail: targetProfile?.email,
                planName: plan,
                previousPlan,
            }).catch(() => {})

            return successResponse({ message: `Plan changé en ${plan}` })
        }

        if (action === 'cancel') {
            // Get current user info for notification
            const { data: targetProfile } = await adminSupabase
                .from('profiles')
                .select('email, plan')
                .eq('id', id)
                .single()

            const { error } = await adminSupabase
                .from('profiles')
                .update({ plan: 'free', subscription_plan: 'Free' })
                .eq('id', id)

            if (error) throw error
            await logAdminAction(user.id, 'cancel_subscription', id, 'profile')

            // Notify admins of subscription cancellation
            notifyAdmins('subscription_cancelled', {
                userId: id,
                userEmail: targetProfile?.email,
                previousPlan: targetProfile?.plan,
            }).catch(() => {})

            return successResponse({ message: 'Abonnement annulé (rétrogradé en Free)' })
        }

        if (action === 'set_credits') {
            if (credits === undefined) return errorResponse('Crédits requis', 400)
            const { error } = await adminSupabase
                .from('profiles')
                .update({ credits_balance: Number(credits) })
                .eq('id', id)

            if (error) throw error
            await logAdminAction(user.id, 'set_subscription_credits', id, 'profile', { credits })
            return successResponse({ message: `Crédits définis à ${credits}` })
        }

        return errorResponse('Action invalide', 400)
    } catch (err) {
        console.error('Update subscription error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
