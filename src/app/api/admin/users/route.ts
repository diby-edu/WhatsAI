import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/admin/users - Get all users (Admin only)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Verify admin role via metadata (fast check)
    if (user.user_metadata?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    // Use Admin Client to bypass RLS and fetch all profiles
    const adminSupabase = createAdminClient()

    try {
        // Fetch profiles
        const { data: profiles, error } = await adminSupabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching profiles:', error)
            return errorResponse('Erreur lors de la récupération des utilisateurs', 500)
        }

        // Return real data
        return successResponse({ users: profiles })
    } catch (err) {
        console.error('Admin users API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
