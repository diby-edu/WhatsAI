import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse, logAdminAction } from '@/lib/api-utils'

// GET /api/admin/payouts — Get merchant balances + payout history
export async function GET(request: NextRequest) {
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
            const balances = merchantIds.map(userId => {
                const merchantOrders = (paidOrders || []).filter((o: any) => o.agents?.user_id === userId)

                const totalCollected = merchantOrders.reduce((sum: number, o: any) => sum + (o.total_fcfa || 0), 0)

                const totalPaidOut = (completedPayouts || [])
                    .filter(p => p.user_id === userId)
                    .reduce((sum, p) => sum + (p.net_amount || 0), 0)

                const totalCommission = (completedPayouts || [])
                    .filter(p => p.user_id === userId)
                    .reduce((sum, p) => sum + (p.commission_amount || 0), 0)

                const merchantProfile = merchantProfiles?.find(m => m.id === userId)

                return {
                    user_id: userId,
                    full_name: merchantProfile?.full_name || 'Inconnu',
                    email: merchantProfile?.email || '',
                    phone: merchantProfile?.phone || '',
                    total_collected: totalCollected,
                    total_paid_out: totalPaidOut,
                    total_commission: totalCommission,
                    balance_due: totalCollected - totalPaidOut - totalCommission,
                    orders_count: merchantOrders.length
                }
            }).sort((a, b) => b.balance_due - a.balance_due)

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

            const formattedPayouts = (payouts || []).map((p: any) => ({
                ...p,
                merchant_name: p.merchant?.full_name || 'Inconnu',
                merchant_email: p.merchant?.email || '',
                processed_by_name: p.processor?.full_name || null,
                merchant: undefined,
                processor: undefined
            }))

            return successResponse({ payouts: formattedPayouts })
        }
    } catch (err) {
        console.error('Admin payouts error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST /api/admin/payouts — Create a new payout
export async function POST(request: NextRequest) {
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

        const commission_amount = Math.round(gross_amount * (commission_rate / 100))
        const net_amount = gross_amount - commission_amount

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
