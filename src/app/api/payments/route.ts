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
                payment_method_source,
                description,
                credits_purchased,
                provider_transaction_id,
                payment_channel,
                payment_channel_detail,
                created_at,
                completed_at
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50)

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
            payment_type: payment.payment_type,
            source: payment.payment_method_source === 'manual' ? 'manual' : 'automatic',
            payment_provider: payment.payment_provider,
            payment_channel: payment.payment_channel,
            payment_channel_detail: payment.payment_channel_detail,
            credits: payment.credits_purchased,
            reference: payment.provider_transaction_id,
            created_at: payment.created_at,
            completed_at: payment.completed_at,
        }))

        // Entrée synthétique si l'abonnement actif n'a pas d'entrée dans payments
        const hasSubscriptionEntry = formattedPayments.some(p => p.payment_type === 'subscription' && p.status === 'completed')
        if (!hasSubscriptionEntry) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('plan, paid_until')
                .eq('id', user.id)
                .single()

            if (profile?.plan && profile.plan !== 'free') {
                const paidUntil = profile.paid_until ? new Date(profile.paid_until) : null
                const isActive = !paidUntil || paidUntil > new Date()
                if (isActive) {
                    formattedPayments.unshift({
                        id: 'synthetic_sub',
                        amount_fcfa: 0,
                        description: paidUntil
                            ? `Abonnement ${profile.plan} — actif jusqu'au ${paidUntil.toLocaleDateString('fr-FR')}`
                            : `Abonnement ${profile.plan} — actif`,
                        status: 'completed',
                        payment_type: 'subscription',
                        source: 'manual',
                        payment_provider: 'admin',
                        payment_channel: null,
                        payment_channel_detail: null,
                        credits: null,
                        reference: null,
                        created_at: null,
                        completed_at: profile.paid_until,
                    })
                }
            }
        }

        return successResponse({ payments: formattedPayments })
    } catch (err) {
        console.error('Error:', err)
        return successResponse({ payments: [] })
    }
}
