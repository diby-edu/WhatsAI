import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { hasProfilePhone } from '@/lib/profile-phone'

const handleI18n = createMiddleware({
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
})

const PUBLIC_ROUTES = new Set([
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/pricing',
    '/features',
    '/about',
    '/contact',
    '/auth/callback',
    '/api/payments/webhook',
])

const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/onboarding', '/complete-profile']

function isWithinPath(pathname: string, prefix: string) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function getLocale(pathname: string) {
    return pathname.match(/^\/(fr|en)(?=\/|$)/)?.[1] || 'fr'
}

function redirectTo(request: NextRequest, locale: string, path: string) {
    return NextResponse.redirect(new URL(`/${locale}${path}`, request.url))
}

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    let response = handleI18n(request)

    if (pathname.startsWith('/api') || pathname.startsWith('/auth/callback')) {
        response = NextResponse.next({ request })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return response
    }

    // ── Mode Maintenance ──────────────────────────────────────────────────────
    // Exempté : /api, /admin, /maintenance, /_next
    const pathnameBase = pathname.replace(/^\/(fr|en)(?=\/|$)/, '') || '/'
    const isMaintenanceExempt =
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        isWithinPath(pathnameBase, '/admin') ||
        isWithinPath(pathnameBase, '/maintenance')

    if (!isMaintenanceExempt) {
        try {
            const maintClient = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                { cookies: { getAll: () => [], setAll: () => {} } }
            )
            const { data } = await maintClient
                .from('feature_flags')
                .select('enabled')
                .eq('key', 'maintenance_mode')
                .maybeSingle()

            if (data?.enabled === true) {
                const locale = getLocale(pathname)
                return redirectTo(request, locale, '/maintenance')
            }
        } catch { /* silencieux */ }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const locale = getLocale(pathname)
    const pathnameWithoutLocale = pathname.replace(/^\/(fr|en)(?=\/|$)/, '') || '/'
    const isAuthPage = pathnameWithoutLocale === '/login' || pathnameWithoutLocale === '/register'
    const isPublicRoute = PUBLIC_ROUTES.has(pathnameWithoutLocale) || pathnameWithoutLocale.startsWith('/api/public')
    const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => isWithinPath(pathnameWithoutLocale, prefix))

    if (!user && !isPublicRoute && isProtectedRoute) {
        const redirectUrl = new URL(`/${locale}/login`, request.url)
        redirectUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(redirectUrl)
    }

    if (!user) {
        return response
    }

    const needsProfileState = isProtectedRoute || isAuthPage

    if (!needsProfileState) {
        return response
    }

    let profileRole: string | null = null
    let profilePhone: string | null = null
    let profileOnboardingCompleted = false

    if (needsProfileState) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, phone, onboarding_completed')
            .eq('id', user.id)
            .maybeSingle()

        profileRole = profile?.role ?? null
        profilePhone = profile?.phone ?? null
        profileOnboardingCompleted = profile?.onboarding_completed === true
    }

    const metadataRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null
    const userRole = metadataRole || profileRole
    const isAdmin = userRole === 'admin' || userRole === 'superadmin'
    const onboardingCompleted = profileOnboardingCompleted
    const hasPhone = hasProfilePhone(profilePhone)

    if (isAdmin) {
        if (
            isAuthPage ||
            isWithinPath(pathnameWithoutLocale, '/dashboard') ||
            isWithinPath(pathnameWithoutLocale, '/onboarding') ||
            isWithinPath(pathnameWithoutLocale, '/complete-profile')
        ) {
            return redirectTo(request, locale, '/admin')
        }

        return response
    }

    if (isWithinPath(pathnameWithoutLocale, '/admin')) {
        if (!onboardingCompleted) return redirectTo(request, locale, '/onboarding')
        if (!hasPhone) return redirectTo(request, locale, '/complete-profile')
        return redirectTo(request, locale, '/dashboard')
    }

    if (isAuthPage) {
        if (!onboardingCompleted) return redirectTo(request, locale, '/onboarding')
        if (!hasPhone) return redirectTo(request, locale, '/complete-profile')
        return redirectTo(request, locale, '/dashboard')
    }

    if (!onboardingCompleted) {
        if (!isWithinPath(pathnameWithoutLocale, '/onboarding')) {
            return redirectTo(request, locale, '/onboarding')
        }
        return response
    }

    if (!hasPhone) {
        if (!isWithinPath(pathnameWithoutLocale, '/complete-profile')) {
            return redirectTo(request, locale, '/complete-profile')
        }
        return response
    }

    if (
        isWithinPath(pathnameWithoutLocale, '/onboarding') ||
        isWithinPath(pathnameWithoutLocale, '/complete-profile')
    ) {
        return redirectTo(request, locale, '/dashboard')
    }

    return response
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
