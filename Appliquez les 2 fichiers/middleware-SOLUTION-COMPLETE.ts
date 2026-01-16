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

    // If API route, bypass intl logic
    if (pathname.startsWith('/api')) {
        response = NextResponse.next({ request });
    }

    // 2. Supabase Logic
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

    // ═══════════════════════════════════════════════════════════════
    // ⭐ FIX #1 : Vérifier le rôle de l'utilisateur connecté
    // ═══════════════════════════════════════════════════════════════
    let userRole: string | null = null;
    
    if (user) {
        // Vérifier métadonnées (rapide)
        userRole = user.user_metadata?.role;
        
        // Si pas dans metadata, vérifier DB
        if (!userRole) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            
            userRole = profile?.role || null;
        }
        
        console.log(`🔐 Middleware - User: ${user.email}, Role: ${userRole}, Path: ${pathnameWithoutLocale}`);
    }
    
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // ═══════════════════════════════════════════════════════════════
    // ⭐ FIX #2 : Rediriger admin de /dashboard vers /admin
    // ═══════════════════════════════════════════════════════════════
    if (user && isAdmin && pathnameWithoutLocale.startsWith('/dashboard')) {
        const locale = pathname.match(/^\/(fr|en)/)?.[1] || 'fr';
        console.log(`🔄 Redirecting admin from /dashboard to /admin`);
        return NextResponse.redirect(new URL(`/${locale}/admin`, request.url));
    }

    // ═══════════════════════════════════════════════════════════════
    // ⭐ FIX #3 : Bloquer non-admin qui essaye d'accéder à /admin
    // ═══════════════════════════════════════════════════════════════
    if (user && !isAdmin && pathnameWithoutLocale.startsWith('/admin')) {
        const locale = pathname.match(/^\/(fr|en)/)?.[1] || 'fr';
        console.log(`❌ Non-admin blocked from /admin, redirecting to /dashboard`);
        return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }

    // ═══════════════════════════════════════════════════════════════
    // ⭐ FIX #4 : Rediriger admin qui se connecte vers /admin (pas /dashboard)
    // ═══════════════════════════════════════════════════════════════
    if (user && (pathnameWithoutLocale === '/login' || pathnameWithoutLocale === '/register')) {
        const locale = pathname.match(/^\/(fr|en)/)?.[1] || 'fr';
        
        if (isAdmin) {
            console.log(`🔄 Redirecting admin from login to /admin`);
            return NextResponse.redirect(new URL(`/${locale}/admin`, request.url));
        }
        
        return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }

    return response
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
