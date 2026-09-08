import { NextRequest } from 'next/server'
import { errorResponse, successResponse, getPagination, paginatedResponse, sanitizePostgrestSearch } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

// GET /api/admin/users - Get all users (Admin only) with pagination
export async function GET(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    // Audit F-05 : plafonner pageSize pour éviter la lecture de plages arbitrairement grandes.
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '20') || 20), 100)
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
        // Audit F-05 : neutraliser les métacaractères PostgREST avant interpolation.
        if (search) {
            const safe = sanitizePostgrestSearch(search)
            if (safe) {
                query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
            }
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
