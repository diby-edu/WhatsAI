import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function buildRedirectUrl(origin: string, forwardedHost: string | null, path: string) {
    if (process.env.NODE_ENV !== 'development' && forwardedHost) {
        return `https://${forwardedHost}${path}`
    }
    return `${origin}${path}`
}

async function resolveOnboardingPath(supabase: ReturnType<typeof createServerClient>, fallback: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()

    // Only applies to OAuth users — email users already have the flag set via signUp()
    if (!user || user.user_metadata?.onboarding_completed !== undefined) return fallback

    const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()

    if (profile?.onboarding_completed === false) {
        // Flag metadata so the middleware stays in sync on subsequent requests
        await supabase.auth.updateUser({ data: { onboarding_completed: false } })
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
