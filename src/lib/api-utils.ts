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

/**
 * Helper to get pagination range for Supabase
 */
export function getPagination(page: number, size: number) {
    const limit = size ? +size : 10
    const from = page ? (page - 1) * limit : 0
    const to = page ? from + limit - 1 : limit - 1

    return { from, to, limit }
}

/**
 * Standard paginated response structure
 */
export function paginatedResponse(data: any, count: number, page: number, size: number) {
    return NextResponse.json({
        data,
        meta: {
            total: count || 0,
            page: Number(page) || 1,
            size: Number(size) || data.length,
            last_page: Math.ceil((count || 0) / (size || 10))
        }
    })
}

/**
 * Log an admin action to the audit trail
 */
export async function logAdminAction(
    adminId: string,
    actionType: string,
    targetId?: string,
    targetType?: string,
    metadata: any = {}
) {
    const adminSupabase = createAdminClient()
    try {
        await adminSupabase.from('admin_audit_logs').insert({
            admin_id: adminId,
            action_type: actionType,
            target_id: targetId,
            target_type: targetType,
            metadata
        })
    } catch (err) {
        console.error('Failed to log admin action:', err)
    }
}
