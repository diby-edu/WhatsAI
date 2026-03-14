import type { SupabaseClient } from '@supabase/supabase-js'

function isAdminRole(role: string | null | undefined): boolean {
    return role === 'admin' || role === 'superadmin'
}

type RedirectPath = '/admin' | '/onboarding' | '/dashboard'

/**
 * Resolve a consistent post-auth redirect path for both web OAuth and native Google login.
 * Keeps middleware expectations in sync by writing onboarding metadata when needed.
 */
export async function resolvePostAuthPath(supabase: SupabaseClient): Promise<RedirectPath> {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return '/dashboard'
    }

    const metadataRole = typeof user.user_metadata?.role === 'string'
        ? user.user_metadata.role
        : null

    let profileRole: string | null = null
    let profileOnboardingCompleted: boolean = false

    if (!isAdminRole(metadataRole)) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, onboarding_completed')
            .eq('id', user.id)
            .maybeSingle()

        profileRole = profile?.role || null
        profileOnboardingCompleted = profile?.onboarding_completed === true ? true : false
    }

    const effectiveRole = metadataRole || profileRole
    const onboardingCompleted = profileOnboardingCompleted

    if (isAdminRole(effectiveRole)) {
        return '/admin'
    }

    if (onboardingCompleted === false) {
        return '/onboarding'
    }

    return '/dashboard'
}

