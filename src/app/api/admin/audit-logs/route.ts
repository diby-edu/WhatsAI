import { NextRequest } from 'next/server'
import { errorResponse, getPagination, paginatedResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const { from, to } = getPagination(page, pageSize)

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
