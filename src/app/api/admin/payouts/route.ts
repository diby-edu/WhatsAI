import { NextRequest } from 'next/server'
import { errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'
import { calculateMerchantBalances, formatPayoutHistory, calculateCommission } from '@/lib/services/payout-metrics'

// GET /api/admin/payouts — Get merchant balances + payout history
export async function GET(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'balances' // 'balances' or 'history'

    try {
        if (view === 'balances') {
            // Get all paid orders with their agent (merchant) info
            const { data: paidOrders, error: ordersError } = await adminSupabase
                .from('orders')
                .select('total_fcfa, agent_id, agents!orders_agent_id_fkey(user_id)')
                .eq('status', 'paid')

            if (ordersError) throw ordersError

            // Get all completed payouts
            const { data: completedPayouts, error: payoutsError } = await adminSupabase
                .from('payouts')
                .select('user_id, net_amount, commission_amount')
                .eq('status', 'completed')

            if (payoutsError) throw payoutsError

            // Extract merchant user_ids from orders via agents
            const merchantIds = [...new Set(
                (paidOrders || [])
                    .map((o: any) => o.agents?.user_id)
                    .filter(Boolean)
            )]

            const { data: merchantProfiles } = await adminSupabase
                .from('profiles')
                .select('id, full_name, email, phone')
                .in('id', merchantIds.length > 0 ? merchantIds : ['00000000-0000-0000-0000-000000000000'])

            // Calculate balances per merchant
            const balances = calculateMerchantBalances({
                paidOrders: paidOrders as any,
                completedPayouts,
                merchantProfiles,
                merchantIds,
            })

            return successResponse({ balances })

        } else {
            // Payout history
            const { data: payouts, error } = await adminSupabase
                .from('payouts')
                .select(`
                    *,
                    merchant:profiles!payouts_user_id_fkey(full_name, email),
                    processor:profiles!payouts_processed_by_fkey(full_name)
                `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error

            const formattedPayouts = formatPayoutHistory(payouts)

            return successResponse({ payouts: formattedPayouts })
        }
    } catch (err) {
        console.error('Admin payouts error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST /api/admin/payouts — Create a new payout
export async function POST(request: NextRequest) {
    const { user, adminSupabase, response } = await requireAdminAccess()
    if (response || !user || !adminSupabase) return response!

    try {
        const body = await request.json()
        const { user_id, gross_amount, payment_method, notes, period_start, period_end } = body
        let { commission_rate } = body

        // If no rate provided, fetch global default
        if (!commission_rate) {
            const { data: setting } = await adminSupabase
                .from('app_settings')
                .select('value')
                .eq('key', 'default_commission_rate')
                .single()

            commission_rate = setting ? parseInt(setting.value) : 10
        }

        if (!user_id || !gross_amount || !period_start || !period_end) {
            return errorResponse('Champs requis: user_id, gross_amount, period_start, period_end', 400)
        }

        const { commission_amount, net_amount } = calculateCommission(gross_amount, commission_rate)

        const { data: payout, error } = await adminSupabase
            .from('payouts')
            .insert({
                user_id,
                gross_amount,
                commission_rate,
                commission_amount,
                net_amount,
                period_start,
                period_end,
                payment_method: payment_method || null,
                notes: notes || null,
                processed_by: user.id,
                status: 'pending'
            })
            .select()
            .single()

        if (error) throw error

        await logAdminAction(user.id, 'create_payout', payout.id, 'payout', { user_id, gross_amount, net_amount })

        return successResponse({ payout }, 201)
    } catch (err) {
        console.error('Create payout error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
