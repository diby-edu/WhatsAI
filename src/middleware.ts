import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

const EXEMPT_PREFIXES = ['/_next', '/favicon', '/api/', '/maintenance']

async function isMaintenanceActive(request: NextRequest): Promise<boolean> {
    // Cache via cookie 30s pour éviter une requête DB à chaque page
    const cached = request.cookies.get('__maint')
    if (cached) return cached.value === '1'

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => [], setAll: () => {} } }
        )
        const { data } = await supabase
            .from('feature_flags')
            .select('enabled')
            .eq('key', 'maintenance_mode')
            .maybeSingle()
        return data?.enabled === true
    } catch {
        return false
    }
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Toujours laisser passer : assets, API, admin, page maintenance
    if (EXEMPT_PREFIXES.some(p => pathname.startsWith(p)) || pathname.includes('/admin')) {
        return updateSession(request)
    }

    const maintenance = await isMaintenanceActive(request)

    if (maintenance && !pathname.includes('/maintenance')) {
        // Conserver la locale (fr/en)
        const parts = pathname.split('/')
        const locale = ['fr', 'en'].includes(parts[1]) ? parts[1] : 'fr'
        const url = new URL(`/${locale}/maintenance`, request.url)
        const res = NextResponse.redirect(url)
        res.cookies.set('__maint', '1', { maxAge: 30, path: '/' })
        return res
    }

    const res = await updateSession(request)
    // Invalider le cache si maintenance désactivée
    if (!maintenance) {
        res.cookies.set('__maint', '0', { maxAge: 30, path: '/' })
    }
    return res
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
