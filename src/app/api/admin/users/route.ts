import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse, getPagination, paginatedResponse } from '@/lib/api-utils'

// GET /api/admin/users - Get all users (Admin only) with pagination
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Verify admin role via DB (secure)
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const { from, to } = getPagination(page, pageSize)

    try {
        // Fetch profiles with count
        const { data: profiles, error, count } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)

        if (error) {
            console.error('Error fetching profiles:', error)
            return errorResponse('Erreur lors de la récupération des utilisateurs', 500)
        }

        // Return paginated response
        return paginatedResponse(profiles, count || 0, page, pageSize)
    } catch (err) {
        console.error('Admin users API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
