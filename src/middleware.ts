import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware';

const handleI18n = createMiddleware({
    locales: ['fr', 'en'],
    defaultLocale: 'fr'
});

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // 1. Run next-intl middleware
    let response = handleI18n(request);

    // If API route, bypass intl logic (though matcher handles this mostly)
    // We create a passthrough response for API to allow headers manipulation if needed
    if (pathname.startsWith('/api')) {
        response = NextResponse.next({ request });
    }

    // 2. Supabase Logic
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        // Dev fallback if keys missing
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
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // 3. Auth Guard Logic
    // Normalize path to ignore locale (remove /fr or /en prefix)
    const pathnameWithoutLocale = pathname.replace(/^\/(fr|en)/, '') || '/';

    const publicRoutes = [
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
    ]

    const isPublicRoute = publicRoutes.some(route =>
        pathnameWithoutLocale === route || pathnameWithoutLocale.startsWith('/api/public')
    )

    // Auth checks
    if (!user && !isPublicRoute && (pathnameWithoutLocale.startsWith('/dashboard') || pathnameWithoutLocale.startsWith('/admin'))) {
        const locale = pathname.match(/^\/(fr|en)/)?.[1] || 'fr';
        const redirectUrl = new URL(`/${locale}/login`, request.url);
        redirectUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(redirectUrl);
    }

    // Admin checks
    if (pathnameWithoutLocale.startsWith('/admin') && user) {
        if (user.user_metadata?.role === 'admin') {
            return response
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'admin') {
            const locale = pathname.match(/^\/(fr|en)/)?.[1] || 'fr';
            return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
        }
    }

    // Authenticated user trying to access auth pages
    if (user && (pathnameWithoutLocale === '/login' || pathnameWithoutLocale === '/register')) {
        const locale = pathname.match(/^\/(fr|en)/)?.[1] || 'fr';
        return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
    }

    return response
}

export const config = {
    matcher: [
        // Match all except static files and API
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
