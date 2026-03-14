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

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    let response = handleI18n(request)

    if (pathname.startsWith('/api') || pathname.startsWith('/auth/callback')) {
        response = NextResponse.next({ request })
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return response
    }

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

    let profileRole: string | null = null
    let profilePhone: string | null = null

    if (needsProfileState) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, phone')
            .eq('id', user.id)
            .maybeSingle()

        profileRole = profile?.role ?? null
        profilePhone = profile?.phone ?? null
    }

    const metadataRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null
    const userRole = metadataRole || profileRole
    const isAdmin = userRole === 'admin' || userRole === 'superadmin'
    const onboardingCompleted = user.user_metadata?.onboarding_completed !== false
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
