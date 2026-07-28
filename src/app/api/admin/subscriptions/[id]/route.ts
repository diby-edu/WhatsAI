import { NextRequest } from 'next/server'
import { errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { notifyAdmins } from '@/lib/notifications/admin-notify'
import { markUserAsQualified } from '@/lib/test-account'

// PATCH /api/admin/subscriptions/[id] — Update user subscription (plan, credits, cancel)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, adminSupabase, response } = await requireAdminAccess()
    if (response || !user || !adminSupabase) return response!

    try {
        const { id } = await params
        const body = await request.json()
        const { action, plan, credits, billing_period } = body

        if (action === 'change_plan') {
            if (!plan) return errorResponse('Plan requis', 400)
            const validPlans = ['free', 'starter', 'pro', 'business', 'scale']
            if (!validPlans.includes(plan)) return errorResponse('Plan invalide', 400)

            const billingPeriod: 'monthly' | 'annual' = billing_period === 'annual' ? 'annual' : 'monthly'

            // Get current plan to determine upgrade vs downgrade
            const { data: targetProfile } = await adminSupabase
                .from('profiles')
                .select('plan, email, credits_balance')
                .eq('id', id)
                .single()

            // Calculate paid_until
            const now = new Date()
            const paidUntil = plan === 'free' ? null : new Date(
                now.getTime() + (billingPeriod === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000
            )

            // Fetch credits from subscription_plans
            let creditsToAdd = 0
            try {
                const { data: planData } = await adminSupabase
                    .from('subscription_plans')
                    .select('credits_included')
                    .eq('id', plan)
                    .single()
                if (planData?.credits_included) creditsToAdd = planData.credits_included * (billingPeriod === 'annual' ? 12 : 1)
            } catch { /* non-bloquant */ }

            const newLifecycle = plan === 'free' ? 'inactive' : 'paid_active'
            const newCredits = (targetProfile?.credits_balance || 0) + creditsToAdd

            const { error } = await adminSupabase
                .from('profiles')
                .update({
                    plan,
                    subscription_plan: plan,
                    account_lifecycle_status: newLifecycle,
                    paid_until: paidUntil?.toISOString() ?? null,
                    credits_balance: newCredits,
                })
                .eq('id', id)

            if (error) throw error

            // Un plan payant attribué manuellement qualifie le compte comme un vrai paiement
            // (efface test_account_cleanup_deadline, sinon le badge admin reste bloqué sur "Test")
            if (plan !== 'free') {
                try { await markUserAsQualified(adminSupabase, id) } catch { /* non-bloquant */ }
            }

            // Créer un enregistrement dans payments pour l'historique de facturation
            if (plan !== 'free') {
                await adminSupabase.from('payments').insert({
                    user_id: id,
                    amount_fcfa: 0,
                    status: 'completed',
                    payment_provider: 'admin',
                    payment_type: 'subscription',
                    payment_method_source: 'manual',
                    description: `Abonnement ${plan} (${billingPeriod === 'annual' ? 'annuel' : 'mensuel'}) — ajouté manuellement`,
                    credits_purchased: creditsToAdd,
                    completed_at: new Date().toISOString()
                })
            }
            await logAdminAction(user.id, 'change_subscription_plan', id, 'profile', { plan, billing_period: billingPeriod, paid_until: paidUntil })

            // Notify admins of plan change
            const planOrder = ['free', 'starter', 'pro', 'business', 'scale']
            const previousPlan = targetProfile?.plan || 'free'
            const isUpgrade = planOrder.indexOf(plan) > planOrder.indexOf(previousPlan)
            notifyAdmins(isUpgrade ? 'plan_upgrade' : 'plan_downgrade', {
                userId: id,
                userEmail: targetProfile?.email,
                planName: plan,
                previousPlan,
            }).catch(() => {})

            return successResponse({ message: `Plan changé en ${plan} (${billingPeriod === 'annual' ? 'annuel' : 'mensuel'})` })
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
                .update({
                    plan: 'free',
                    subscription_plan: 'Free',
                    account_lifecycle_status: 'inactive',
                    paid_until: null,
                    grace_until: null,
                })
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
