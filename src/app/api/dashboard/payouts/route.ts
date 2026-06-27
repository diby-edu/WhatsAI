import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/dashboard/payouts — Merchant's own earnings & payout history
export async function GET(_request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    const adminSupabase = createAdminClient()

    try {
        // Paid orders for this merchant's agents
        const { data: paidOrders, error: ordersError } = await adminSupabase
            .from('orders')
            .select('id, total_fcfa, created_at, agent_id, agents!orders_agent_id_fkey(name, user_id)')
            .eq('status', 'paid')

        if (ordersError) throw ordersError

        const myOrders = (paidOrders || []).filter((o: any) => o.agents?.user_id === user.id)

        const totalCollected = myOrders.reduce((sum: number, o: any) => sum + (o.total_fcfa || 0), 0)

        // Completed payouts received by this merchant
        const { data: payouts, error: payoutsError } = await adminSupabase
            .from('payouts')
            .select('id, gross_amount, commission_rate, commission_amount, net_amount, status, payment_method, payment_reference, period_start, period_end, created_at, paid_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50)

        if (payoutsError) throw payoutsError

        const totalPaidOut = (payouts || [])
            .filter((p: any) => p.status === 'completed')
            .reduce((sum: number, p: any) => sum + (p.net_amount || 0), 0)

        const totalCommission = (payouts || [])
            .filter((p: any) => p.status === 'completed')
            .reduce((sum: number, p: any) => sum + (p.commission_amount || 0), 0)

        return successResponse({
            balance: {
                total_collected: totalCollected,
                total_paid_out: totalPaidOut,
                total_commission: totalCommission,
                balance_due: totalCollected - totalPaidOut - totalCommission,
                orders_count: myOrders.length,
            },
            payouts: payouts || [],
        })
    } catch (err) {
        console.error('Dashboard payouts error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
