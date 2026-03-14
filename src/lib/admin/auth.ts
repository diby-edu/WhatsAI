import type { SupabaseClient } from '@supabase/supabase-js'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, isAdminRole } from '@/lib/api-utils'

export async function requireAdminAccess() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return {
            user: null,
            profile: null,
            adminSupabase: null,
            response: errorResponse('Non autorise', 401),
        }
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .single()

    if (!isAdminRole(profile?.role)) {
        return {
            user: null,
            profile: null,
            adminSupabase: null,
            response: errorResponse('Acces refuse', 403),
        }
    }

    return {
        user,
        profile,
        adminSupabase,
        response: null,
    }
}

export async function getCurrentUserRole(
    supabase: SupabaseClient,
    userId: string
): Promise<string | null> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

    return profile?.role || null
}
