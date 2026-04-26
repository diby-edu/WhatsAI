import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/dashboard/subscription-history
// Retourne tous les paiements qui ont repoussé l'échéance (abonnements)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    try {
        const { data: payments, error } = await supabase
            .from('payments')
            .select('id, amount_fcfa, status, payment_type, payment_provider, payment_method_source, admin_notes, provider_response, created_at, completed_at')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .eq('payment_type', 'subscription')
            .order('completed_at', { ascending: false })

        if (error) throw error

        // Reconstruit les fenêtres d'échéance : chaque abonnement = +1 mois depuis la date du paiement précédent
        const history = (payments || []).map((p, index, arr) => {
            const completedAt = new Date(p.completed_at || p.created_at)
            const periodStart = completedAt
            const periodEnd = new Date(completedAt)
            periodEnd.setMonth(periodEnd.getMonth() + 1)

            return {
                id: p.id,
                amount_fcfa: p.amount_fcfa,
                source: p.payment_method_source === 'manual' ? 'manual' : 'automatic',
                provider: p.payment_provider,
                admin_notes: p.admin_notes || null,
                period_start: periodStart.toISOString(),
                period_end: periodEnd.toISOString(),
                completed_at: p.completed_at || p.created_at,
            }
        })

        return successResponse({ history })
    } catch (err) {
        console.error('Error fetching subscription history:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
