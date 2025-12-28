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

    if (profile?.role !== 'admin') {
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

        // Get monthly revenue from completed payments this month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { data: monthlyPayments } = await adminSupabase
            .from('payments')
            .select('amount_fcfa')
            .eq('status', 'completed')
            .gte('created_at', startOfMonth.toISOString())

        const monthlyRevenue = monthlyPayments?.reduce((sum, p) => sum + (p.amount_fcfa || 0), 0) || 0

        // New subscriptions this month
        const { data: newThisMonth } = await adminSupabase
            .from('payments')
            .select('id')
            .eq('status', 'completed')
            .eq('payment_type', 'subscription')
            .gte('created_at', startOfMonth.toISOString())

        const newCount = newThisMonth?.length || 0

        const stats = {
            activeSubscriptions: activeCount,
            monthlyRevenue: monthlyRevenue,
            newThisMonth: newCount
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
        newThisMonth: 0
    }
}
