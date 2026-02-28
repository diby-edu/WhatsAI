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
    const metadataOnboarding = user.user_metadata?.onboarding_completed

    let profileRole: string | null = null
    let profileOnboarding: boolean | null = null

    const shouldLoadProfile =
        !isAdminRole(metadataRole) || metadataOnboarding === undefined

    if (shouldLoadProfile) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, onboarding_completed')
            .eq('id', user.id)
            .maybeSingle()

        profileRole = profile?.role || null
        profileOnboarding = typeof profile?.onboarding_completed === 'boolean'
            ? profile.onboarding_completed
            : null
    }

    const effectiveRole = metadataRole || profileRole
    const onboardingCompleted = typeof metadataOnboarding === 'boolean'
        ? metadataOnboarding
        : profileOnboarding

    // Native Google login bypasses /auth/callback. Keep metadata aligned with DB.
    if (metadataOnboarding === undefined && profileOnboarding === false) {
        await supabase.auth.updateUser({
            data: { onboarding_completed: false },
        })
    }

    if (isAdminRole(effectiveRole)) {
        return '/admin'
    }

    if (onboardingCompleted === false) {
        return '/onboarding'
    }

    return '/dashboard'
}

