import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { notifyAdmins } from '@/lib/notifications/admin-notify'

function buildRedirectUrl(origin: string, forwardedHost: string | null, path: string) {
    if (process.env.NODE_ENV !== 'development' && forwardedHost) {
        return `https://${forwardedHost}${path}`
    }
    return `${origin}${path}`
}

async function resolveOnboardingPath(supabase: ReturnType<typeof createServerClient>, fallback: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()

    // Skip if onboarding already confirmed (=== true means user has completed it)
    // Note: email users have onboarding_completed: false in metadata from signUp()
    //       OAuth users have no onboarding_completed key in metadata initially
    //       Both cases must fall through to the profile check below
    if (!user || user.user_metadata?.onboarding_completed === true) return fallback

    const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()

    if (profile?.onboarding_completed === false) {
        // Flag metadata so the middleware stays in sync on subsequent requests
        await supabase.auth.updateUser({ data: { onboarding_completed: false } })
        // New user — notify admins (fire-and-forget, never blocks redirect)
        notifyAdmins('new_user', {
            userId: user.id,
            userEmail: user.email,
            userName: user.user_metadata?.full_name || user.user_metadata?.name,
        }).catch(() => {})
        return '/onboarding'
    }

    return fallback
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options)
                    })
                },
            },
        }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
        return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }

    const redirectPath = await resolveOnboardingPath(supabase, next)
    const forwardedHost = request.headers.get('x-forwarded-host')
    return NextResponse.redirect(buildRedirectUrl(origin, forwardedHost, redirectPath))
}
