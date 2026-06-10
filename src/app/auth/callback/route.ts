import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { maybeNotifyNewUserOnce } from '@/lib/auth/new-user-notify'
import { createPendingReferral } from '@/lib/referral'

function buildRedirectUrl(origin: string, forwardedHost: string | null, path: string) {
    if (process.env.NODE_ENV !== 'development' && forwardedHost) {
        return `https://${forwardedHost}${path}`
    }
    return `${origin}${path}`
}

async function resolveOnboardingPath(supabase: ReturnType<typeof createServerClient>, fallback: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return fallback

    const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()

    if (profile?.onboarding_completed === false) {
        await maybeNotifyNewUserOnce({
            userId: user.id,
            userEmail: user.email,
            userName: user.user_metadata?.full_name || user.user_metadata?.name,
        })
        return '/onboarding'
    }

    return fallback
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/dashboard'

    const forwardedHost = request.headers.get('x-forwarded-host')

    if (!code) {
        return NextResponse.redirect(buildRedirectUrl(origin, forwardedHost, '/login?error=auth_failed'))
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
        return NextResponse.redirect(buildRedirectUrl(origin, forwardedHost, '/login?error=auth_failed'))
    }

    // Appliquer le parrainage si un code était stocké avant l'OAuth
    const refCode = cookieStore.get('referral_code')?.value
    if (refCode) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            createPendingReferral(user.id, refCode).catch(err =>
                console.error('[REFERRAL] callback error:', err)
            )
        }
        cookieStore.delete('referral_code')
    }

    const redirectPath = await resolveOnboardingPath(supabase, next)
    return NextResponse.redirect(buildRedirectUrl(origin, forwardedHost, redirectPath))
}
