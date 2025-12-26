import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Create Supabase server client for API routes
export async function createApiClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Ignore cookie errors in server components
                    }
                },
            },
        }
    )
}

// Create Supabase admin client (bypasses RLS)
export function createAdminClient() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            cookies: {
                getAll() { return [] },
                setAll() { },
            },
        }
    )
}

// Standard error response
export function errorResponse(message: string, status: number = 400) {
    return NextResponse.json({ error: message }, { status })
}

// Standard success response
export function successResponse(data: any, status: number = 200) {
    return NextResponse.json({ data }, { status })
}

// Get authenticated user or return error
export async function getAuthUser(supabase: Awaited<ReturnType<typeof createApiClient>>) {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return { user: null, error: 'Non autorisé' }
    }

    return { user, error: null }
}
