import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient, getPagination, paginatedResponse } from '@/lib/api-utils'

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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const { from, to } = getPagination(page, pageSize)

    const adminSupabase = createAdminClient()

    try {
        const { data, error, count } = await adminSupabase
            .from('admin_audit_logs')
            .select('*, profiles(email, full_name)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)

        if (error) throw error

        return paginatedResponse(data, count || 0, page, pageSize)
    } catch (err: any) {
        console.error('Audit logs API error:', err)
        return errorResponse(err.message, 500)
    }
}
