import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET - Get user's payment history
export async function GET(_request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorise', 401)
    }

    try {
        const { data: payments, error } = await supabase
            .from('payments')
            .select(`
                id,
                amount_fcfa,
                status,
                payment_provider,
                payment_type,
                description,
                credits_purchased,
                provider_transaction_id,
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

        const formattedPayments = (payments || []).map((payment: any) => ({
            id: payment.id,
            amount_fcfa: payment.amount_fcfa,
            description: payment.description || (
                payment.payment_type === 'subscription'
                    ? 'Abonnement'
                    : 'Achat de credits'
            ),
            status: payment.status,
            payment_provider: payment.payment_provider,
            credits: payment.credits_purchased,
            reference: payment.provider_transaction_id,
            created_at: payment.created_at,
            completed_at: payment.completed_at,
        }))

        return successResponse({ payments: formattedPayments })
    } catch (err) {
        console.error('Error:', err)
        return successResponse({ payments: [] })
    }
}
