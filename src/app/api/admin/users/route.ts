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

    if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
        return errorResponse('Accès refusé', 403)
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const { from, to } = getPagination(page, pageSize)
    const search = searchParams.get('search')?.trim() || ''

    // Sort params
    const sortByRaw = searchParams.get('sortBy') || 'created_at'
    const sortDir = searchParams.get('sortDir') === 'asc'
    const allowedSortCols = ['created_at', 'full_name', 'email', 'plan', 'credits_balance', 'is_active', 'paid_until']
    const sortBy = allowedSortCols.includes(sortByRaw) ? sortByRaw : 'created_at'

    // Export all emails
    if (searchParams.get('export') === 'emails') {
        const { data: allProfiles } = await adminSupabase
            .from('profiles')
            .select('id, email, full_name, plan, created_at')
            .not('role', 'in', '("admin","superadmin")')
            .order('created_at', { ascending: false })
        const emails = (allProfiles || []).map(p => ({
            id: p.id,
            email: p.email,
            name: p.full_name || '',
            plan: p.plan || 'free',
            date: new Date(p.created_at).toLocaleDateString('fr-FR')
        }))
        return successResponse({ emails, total: emails.length })
    }

    try {
        // Fetch profiles with count
        let query = adminSupabase
            .from('profiles')
            .select('*', { count: 'exact' })
            .not('role', 'in', '("admin","superadmin")')

        // Server-side search across name, email and phone
        if (search) {
            query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
        }

        const { data: profiles, error, count } = await query
            .order(sortBy, { ascending: sortDir })
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
