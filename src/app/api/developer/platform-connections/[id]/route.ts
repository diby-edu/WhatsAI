import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const SUPPORTED_PROVIDERS = new Set(['shopify', 'woocommerce', 'chariow', 'maketou', 'generic'])

function asString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const next = value.trim()
    return next.length > 0 ? next : null
}

function asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function asObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

function parseAllowedEvents(value: unknown): { ok: true; data: string[] | null } | { ok: false; error: string } {
    if (value == null) {
        return { ok: true, data: null }
    }

    if (!Array.isArray(value)) {
        return { ok: false, error: 'allowed_events must be an array of event names or null' }
    }

    const normalized = [...new Set(
        value
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.trim().toLowerCase())
            .filter(Boolean)
    )]

    if (normalized.length === 0) {
        return { ok: true, data: null }
    }

    return { ok: true, data: normalized }
}

function buildInboundUrl(request: NextRequest, token: string): string {
    return `${request.nextUrl.origin}/api/public/v1/incoming/${token}`
}

async function ensureAgentOwnership(admin: ReturnType<typeof createAdminClient>, userId: string, agentId: string): Promise<boolean> {
    const { data, error } = await admin
        .from('agents')
        .select('id')
        .eq('id', agentId)
        .eq('user_id', userId)
        .maybeSingle()

    if (error) return false
    return Boolean(data?.id)
}

// PATCH /api/developer/platform-connections/[id]
export async function PATCH(
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
    const { data: existing, error: existingError } = await admin
        .from('api_platform_connections')
        .select('id, user_id, metadata')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

    if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (!existing) {
        return NextResponse.json({ error: 'Platform connection not found' }, { status: 404 })
    }

    let body: Record<string, unknown>
    try {
        body = asObject(await request.json())
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (typeof body.is_active === 'boolean') {
        updates.is_active = body.is_active
    }

    const name = asString(body.name)
    if (name) {
        updates.name = name
    }

    if ('provider' in body) {
        const provider = asString(body.provider)?.toLowerCase() || null
        if (!provider || !SUPPORTED_PROVIDERS.has(provider)) {
            return NextResponse.json({ error: 'Invalid provider. Allowed: shopify, woocommerce, chariow, maketou, generic' }, { status: 400 })
        }
        updates.provider = provider
    }

    if ('agent_id' in body) {
        const agentId = asString(body.agent_id)
        if (!agentId) {
            return NextResponse.json({ error: 'agent_id must be a non-empty string' }, { status: 400 })
        }
        const ownsAgent = await ensureAgentOwnership(admin, user.id, agentId)
        if (!ownsAgent) {
            return NextResponse.json({ error: 'Agent not found or unauthorized' }, { status: 404 })
        }
        updates.agent_id = agentId
    }

    if ('rate_limit_per_minute' in body) {
        const rateLimitValue = asNumber(body.rate_limit_per_minute)
        if (!rateLimitValue) {
            return NextResponse.json({ error: 'rate_limit_per_minute must be a number between 30 and 5000' }, { status: 400 })
        }
        updates.rate_limit_per_minute = Math.min(5000, Math.max(30, rateLimitValue))
    }

    if ('allowed_events' in body) {
        const allowedEvents = parseAllowedEvents(body.allowed_events)
        if (!allowedEvents.ok) {
            return NextResponse.json({ error: allowedEvents.error }, { status: 400 })
        }
        updates.allowed_events = allowedEvents.data
    }

    if ('metadata' in body) {
        updates.metadata = asObject(body.metadata)
    }

    const externalPlatformName = asString(body.external_platform_name)
    if (externalPlatformName) {
        updates.metadata = {
            ...asObject(existing.metadata),
            ...asObject(updates.metadata),
            external_platform_name: externalPlatformName,
        }
    }

    let rotatedSecret: string | null = null
    if (body.rotate_signing_secret === true) {
        rotatedSecret = `wsec_${randomBytes(24).toString('hex')}`
        updates.signing_secret = rotatedSecret
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await admin
        .from('api_platform_connections')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id, name, provider, agent_id, webhook_token, allowed_events, rate_limit_per_minute, is_active, last_received_at, last_status_code, last_error, metadata, created_at, updated_at')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        data: {
            ...updated,
            webhook_url: buildInboundUrl(request, updated.webhook_token),
            ...(rotatedSecret ? { signing_secret: rotatedSecret } : {}),
        }
    })
}

// DELETE /api/developer/platform-connections/[id]
export async function DELETE(
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
    const { error } = await admin
        .from('api_platform_connections')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
