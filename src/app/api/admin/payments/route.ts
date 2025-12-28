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

        // Fetch payments with correct column names
        const { data: payments, error } = await adminSupabase
            .from('payments')
            .select(`
                id,
                user_id,
                amount_fcfa,
                status,
                payment_type,
                description,
                credits_purchased,
                payment_provider,
                provider_transaction_id,
                customer_email,
                customer_phone,
                created_at,
                completed_at,
                profiles (
                    email,
                    full_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) {
            console.error('Error fetching payments:', error)
            return successResponse({ payments: [] })
        }

        // Transform data for frontend compatibility
        const formattedPayments = (payments || []).map((p: any) => ({
            id: p.id,
            user_id: p.user_id,
            amount: p.amount_fcfa,
            currency: 'FCFA',
            status: p.status,
            payment_method: p.payment_provider || 'cinetpay',
            transaction_id: p.provider_transaction_id,
            payment_type: p.payment_type,
            description: p.description,
            credits_purchased: p.credits_purchased,
            created_at: p.created_at,
            updated_at: p.completed_at,
            email: p.profiles?.email || p.customer_email || 'N/A',
            full_name: p.profiles?.full_name || 'N/A',
            profiles: p.profiles
        }))

        return successResponse({ payments: formattedPayments })
    } catch (err) {
        console.error('Error:', err)
        return successResponse({ payments: [] })
    }
}
