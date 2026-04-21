import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'
import { isExternalSyncAgent } from '@/lib/agents/ecommerce-mode'
import { encryptCredentials } from '@/lib/api/platform-sync-crypto'
import {
    type PlatformSyncProvider,
    validatePlatformSyncCredentials,
} from '@/lib/api/platform-sync-providers'

export const dynamic = 'force-dynamic'

const SUPPORTED_PROVIDERS = new Set<PlatformSyncProvider>(['woocommerce', 'shopify'])

function asString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const next = value.trim()
    return next.length > 0 ? next : null
}

function asObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

function asInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isInteger(parsed)) return parsed
    }
    return null
}

async function ensureOwnedExternalSyncAgent(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    agentId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const { data, error } = await admin
        .from('agents')
        .select('id, mission, ecommerce_mode')
        .eq('id', agentId)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        return { ok: false, status: 500, error: error.message }
    }

    if (!data) {
        return { ok: false, status: 404, error: 'Agent not found or unauthorized' }
    }

    if (!isExternalSyncAgent(data)) {
        return {
            ok: false,
            status: 400,
            error: "Agent must be ecommerce_mode=external_sync to use catalogue sync connections",
        }
    }

    return { ok: true }
}

// GET /api/developer/platform-sync-connections
export async function GET() {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('api_platform_sync_connections')
        .select('id, name, provider, agent_id, is_active, auto_sync_enabled, sync_interval_minutes, retry_count, next_retry_at, credentials_hint, last_tested_at, last_test_status_code, last_test_error, last_synced_at, last_sync_status, last_sync_error, last_sync_count, last_sync_started_at, last_sync_finished_at, metadata, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
}

// POST /api/developer/platform-sync-connections
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
        body = asObject(await request.json())
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const name = asString(body.name)
    const providerRaw = asString(body.provider)?.toLowerCase() || null
    const provider = providerRaw as PlatformSyncProvider | null
    const agentId = asString(body.agent_id)
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : true
    const autoSyncEnabled = typeof body.auto_sync_enabled === 'boolean' ? body.auto_sync_enabled : false
    const syncIntervalRaw = asInteger(body.sync_interval_minutes)
    const syncIntervalMinutes = syncIntervalRaw ?? 15
    const metadata = asObject(body.metadata)

    if (!name) {
        return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
    }
    if (!agentId) {
        return NextResponse.json({ error: 'Missing required field: agent_id' }, { status: 400 })
    }
    if (!provider || !SUPPORTED_PROVIDERS.has(provider)) {
        return NextResponse.json({ error: 'Invalid provider. Allowed: woocommerce, shopify' }, { status: 400 })
    }
    if (syncIntervalMinutes < 5 || syncIntervalMinutes > 1440) {
        return NextResponse.json({ error: 'sync_interval_minutes must be between 5 and 1440' }, { status: 400 })
    }

    const credentialCheck = validatePlatformSyncCredentials(provider, body.credentials)
    if (!credentialCheck.ok) {
        return NextResponse.json({ error: credentialCheck.error }, { status: 400 })
    }

    const admin = createAdminClient()
    const agentCheck = await ensureOwnedExternalSyncAgent(admin, user.id, agentId)
    if (!agentCheck.ok) {
        return NextResponse.json({ error: agentCheck.error }, { status: agentCheck.status })
    }

    const { data, error } = await admin
        .from('api_platform_sync_connections')
        .insert({
            user_id: user.id,
            agent_id: agentId,
            name,
            provider,
            is_active: isActive,
            auto_sync_enabled: autoSyncEnabled,
            sync_interval_minutes: syncIntervalMinutes,
            credentials_encrypted: encryptCredentials(credentialCheck.credentials),
            credentials_hint: credentialCheck.hint,
            metadata,
        })
        .select('id, name, provider, agent_id, is_active, auto_sync_enabled, sync_interval_minutes, retry_count, next_retry_at, credentials_hint, last_tested_at, last_test_status_code, last_test_error, last_synced_at, last_sync_status, last_sync_error, last_sync_count, last_sync_started_at, last_sync_finished_at, metadata, created_at, updated_at')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
}
