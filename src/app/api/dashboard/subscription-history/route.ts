import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/dashboard/subscription-history
// Retourne tous les paiements complétés : abonnements ET crédits (y compris ajouts manuels admin)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    try {
        const { data: payments, error } = await supabase
            .from('payments')
            .select('id, amount_fcfa, status, payment_type, payment_provider, payment_method_source, admin_notes, provider_response, credits_purchased, created_at, completed_at')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .in('payment_type', ['subscription', 'credits'])
            .order('completed_at', { ascending: false })

        if (error) throw error

        const history = (payments || []).map((p) => {
            const completedAt = new Date(p.completed_at || p.created_at)
            const isSubscription = p.payment_type === 'subscription'

            // Les périodes de validité ne s'appliquent qu'aux abonnements
            const periodStart = isSubscription ? completedAt.toISOString() : null
            const periodEnd = isSubscription
                ? (() => { const d = new Date(completedAt); d.setMonth(d.getMonth() + 1); return d.toISOString() })()
                : null

            // Extraire les crédits depuis provider_response si credits_purchased est absent
            const providerData = p.provider_response as Record<string, unknown> | null
            const credits = p.credits_purchased
                || (providerData?.credits as number | undefined)
                || null

            return {
                id: p.id,
                payment_type: p.payment_type,
                amount_fcfa: p.amount_fcfa,
                source: p.payment_method_source === 'manual' ? 'manual' : 'automatic',
                provider: p.payment_provider,
                admin_notes: p.admin_notes || null,
                credits_added: credits,
                period_start: periodStart,
                period_end: periodEnd,
                completed_at: p.completed_at || p.created_at,
            }
        })

        return successResponse({ history })
    } catch (err) {
        console.error('Error fetching subscription history:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
