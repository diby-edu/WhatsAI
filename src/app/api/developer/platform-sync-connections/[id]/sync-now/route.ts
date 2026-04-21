import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'
import { executePlatformSyncConnection } from '@/lib/api/platform-sync-executor'

export const dynamic = 'force-dynamic'

function asObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

function asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

// POST /api/developer/platform-sync-connections/[id]/sync-now
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, unknown> = {}
    try {
        body = asObject(await request.json())
    } catch {
        body = {}
    }

    const maxItemsInput = asNumber(body.max_items)
    const maxItems = Math.min(Math.max(maxItemsInput || 200, 1), 500)

    const admin = createAdminClient()
    const { data: connection, error: connectionError } = await admin
        .from('api_platform_sync_connections')
        .select('id, user_id, provider, agent_id, is_active, auto_sync_enabled, sync_interval_minutes, retry_count, next_retry_at, last_synced_at, credentials_encrypted')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (connectionError) {
        return NextResponse.json({ error: connectionError.message }, { status: 500 })
    }
    if (!connection) {
        return NextResponse.json({ error: 'Sync connection not found' }, { status: 404 })
    }
    if (!connection.is_active) {
        return NextResponse.json({ error: 'Sync connection is inactive' }, { status: 400 })
    }
    const result = await executePlatformSyncConnection(admin, connection, {
        triggerSource: 'manual',
        maxItems,
    })

    if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Sync failed' }, { status: 500 })
    }

    return NextResponse.json({
        data: {
            synced: result.synced,
            fetched: result.fetched,
            has_more: result.hasMore,
            max_items: maxItems,
            started_at: result.startedAt,
            finished_at: result.finishedAt,
        },
    })
}
