import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET - Get user's payment history
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    try {
        const { data: payments, error } = await supabase
            .from('payments')
            .select(`
                id,
                amount_fcfa,
                status,
                payment_type,
                description,
                credits_purchased,
                created_at,
                completed_at
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            console.error('Error fetching payments:', error)
            return successResponse({ payments: [] })
        }

        // Transform for frontend
        const formattedPayments = (payments || []).map((p: any) => ({
            id: p.id,
            amount_fcfa: p.amount_fcfa,
            description: p.description || (p.payment_type === 'subscription' ? 'Abonnement' : 'Achat de crédits'),
            status: p.status,
            credits: p.credits_purchased,
            created_at: p.created_at
        }))

        return successResponse({ payments: formattedPayments })
    } catch (err) {
        console.error('Error:', err)
        return successResponse({ payments: [] })
    }
}
