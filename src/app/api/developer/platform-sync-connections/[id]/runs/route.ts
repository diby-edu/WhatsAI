import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

function asInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isInteger(parsed)) return parsed
    }
    return null
}

// GET /api/developer/platform-sync-connections/[id]/runs?limit=20
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: connection, error: connectionError } = await admin
        .from('api_platform_sync_connections')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (connectionError) {
        return NextResponse.json({ error: connectionError.message }, { status: 500 })
    }
    if (!connection) {
        return NextResponse.json({ error: 'Sync connection not found' }, { status: 404 })
    }

    const limitRaw = asInteger(request.nextUrl.searchParams.get('limit'))
    const limit = Math.min(Math.max(limitRaw ?? 20, 1), 100)

    const { data, error } = await admin
        .from('api_platform_sync_runs')
        .select('id, trigger_source, status, fetched_count, synced_count, has_more, error, started_at, finished_at, created_at')
        .eq('connection_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
}
