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

        // Check if payments table exists
        const { data: payments, error } = await adminSupabase
            .from('payments')
            .select(`
                id,
                user_id,
                amount,
                currency,
                status,
                payment_method,
                transaction_id,
                created_at,
                updated_at,
                profiles (
                    email,
                    full_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) {
            console.error('Error fetching payments:', error)
            // Table might not exist, return empty array
            return successResponse({ payments: [] })
        }

        return successResponse({ payments: payments || [] })
    } catch (err) {
        console.error('Error:', err)
        return successResponse({ payments: [] })
    }
}
