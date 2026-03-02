import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 403)
    }

    // Check admin via profile role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Non autorisé', 403)
    }

    try {
        const adminSupabase = createAdminClient()

        // Get all users with paid plans (subscriptions)
        const { data: subscriptions, error } = await adminSupabase
            .from('profiles')
            .select(`
                id,
                email,
                full_name,
                plan,
                credits_balance,
                created_at,
                updated_at
            `)
            .neq('plan', 'free')
            .order('updated_at', { ascending: false })
            .limit(100)

        if (error) {
            console.error('Error fetching subscriptions:', error)
            return successResponse({ subscriptions: [], stats: getEmptyStats() })
        }

        // Get stats
        const activeCount = subscriptions?.length || 0

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        // Monthly payments split by type
        const { data: monthlyPayments } = await adminSupabase
            .from('payments')
            .select('amount_fcfa, payment_type')
            .eq('status', 'completed')
            .gte('created_at', startOfMonth.toISOString())

        const monthlyRevenue = monthlyPayments?.reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
        const monthlyRevenueSub = monthlyPayments?.filter(p => p.payment_type === 'subscription').reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
        const monthlyRevenueCredits = monthlyPayments?.filter(p => p.payment_type === 'credits').reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0

        // All-time payments split by type
        const { data: allPayments } = await adminSupabase
            .from('payments')
            .select('amount_fcfa, payment_type')
            .eq('status', 'completed')

        const totalRevenue = allPayments?.reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
        const totalRevenueSub = allPayments?.filter(p => p.payment_type === 'subscription').reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
        const totalRevenueCredits = allPayments?.filter(p => p.payment_type === 'credits').reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
        const totalCreditPacksCount = allPayments?.filter(p => p.payment_type === 'credits').length || 0
        const totalSubsCount = allPayments?.filter(p => p.payment_type === 'subscription').length || 0

        // New subscriptions this month
        const newCount = monthlyPayments?.filter(p => p.payment_type === 'subscription').length || 0

        // Total users
        const { count: totalUsers } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        const stats = {
            activeSubscriptions: activeCount,
            monthlyRevenue,
            monthlyRevenueSub,
            monthlyRevenueCredits,
            totalRevenue,
            totalRevenueSub,
            totalRevenueCredits,
            totalCreditPacksCount,
            totalSubsCount,
            newThisMonth: newCount,
            totalUsers: totalUsers || 0
        }

        // Format subscriptions for frontend
        const formattedSubs = (subscriptions || []).map((s: any) => ({
            id: s.id,
            user: s.full_name || s.email,
            email: s.email,
            plan: s.plan,
            credits: s.credits_balance,
            status: 'active',
            startDate: new Date(s.created_at).toLocaleDateString('fr-FR'),
            updatedAt: s.updated_at
        }))

        return successResponse({ subscriptions: formattedSubs, stats })
    } catch (err) {
        console.error('Error:', err)
        return successResponse({ subscriptions: [], stats: getEmptyStats() })
    }
}

function getEmptyStats() {
    return {
        activeSubscriptions: 0,
        monthlyRevenue: 0,
        totalRevenue: 0,
        newThisMonth: 0,
        totalUsers: 0
    }
}
