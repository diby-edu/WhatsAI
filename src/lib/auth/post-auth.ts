import type { SupabaseClient } from '@supabase/supabase-js'

function isAdminRole(role: string | null | undefined): boolean {
    return role === 'admin' || role === 'superadmin'
}

type RedirectPath = '/admin' | '/onboarding' | '/dashboard'

/**
 * Resolve a consistent post-auth redirect path for both email/password and native Google login.
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
        try {
            await fetch('/api/auth/new-user-notify', { method: 'POST' })
        } catch {
            // Notification dedupe is best-effort and must never block login.
        }
        return '/onboarding'
    }

    return '/dashboard'
}
