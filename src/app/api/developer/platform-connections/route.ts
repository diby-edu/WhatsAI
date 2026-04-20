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

function maskSecret(secret: string): string {
    if (!secret) return ''
    if (secret.length <= 12) return `${secret.slice(0, 3)}***`
    return `${secret.slice(0, 6)}***${secret.slice(-4)}`
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
    const raw = String(value || '').trim()
    if (!raw) return null
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    try {
        const parsed = new URL(withProtocol)
        return parsed.origin.replace(/\/+$/, '')
    } catch {
        return null
    }
}

function resolvePublicBaseUrl(request: NextRequest): string {
    const fromEnv = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
    if (fromEnv && !/localhost|127\.0\.0\.1/i.test(new URL(fromEnv).hostname)) {
        return fromEnv
    }

    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    if (forwardedHost && !/localhost|127\.0\.0\.1/i.test(forwardedHost)) {
        return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '')
    }

    const origin = request.nextUrl.origin.replace(/\/+$/, '')
    if (/localhost|127\.0\.0\.1/i.test(origin)) {
        return 'https://wazzapai.com'
    }
    return origin
}

function buildInboundUrl(request: NextRequest, token: string): string {
    return `${resolvePublicBaseUrl(request)}/api/public/v1/incoming/${token}`
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

// GET /api/developer/platform-connections
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('api_platform_connections')
        .select('id, name, provider, agent_id, webhook_token, signing_secret, allowed_events, rate_limit_per_minute, is_active, last_received_at, last_status_code, last_error, metadata, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data || []).map((item: any) => {
        const signingSecret = asString(item.signing_secret) || ''
        const token = asString(item.webhook_token) || ''
        return {
            id: item.id,
            name: item.name,
            provider: item.provider,
            agent_id: item.agent_id,
            allowed_events: item.allowed_events,
            rate_limit_per_minute: item.rate_limit_per_minute,
            is_active: item.is_active,
            last_received_at: item.last_received_at,
            last_status_code: item.last_status_code,
            last_error: item.last_error,
            metadata: item.metadata,
            created_at: item.created_at,
            updated_at: item.updated_at,
            webhook_url: buildInboundUrl(request, token),
            webhook_token_preview: token ? `${token.slice(0, 8)}...` : null,
            signing_secret_masked: maskSecret(signingSecret),
        }
    })

    return NextResponse.json({ data: rows })
}

// POST /api/developer/platform-connections
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
    const agentId = asString(body.agent_id)
    const provider = asString(body.provider)?.toLowerCase() || null
    const externalPlatformName = asString(body.external_platform_name)
    const rateLimitValue = asNumber(body.rate_limit_per_minute)
    const rateLimit = Math.min(5000, Math.max(30, rateLimitValue || 300))
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : true
    const metadata = asObject(body.metadata)
    const allowedEventsParsed = parseAllowedEvents(body.allowed_events)

    if (!name) {
        return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
    }
    if (!agentId) {
        return NextResponse.json({ error: 'Missing required field: agent_id' }, { status: 400 })
    }
    if (!provider || !SUPPORTED_PROVIDERS.has(provider)) {
        return NextResponse.json({ error: 'Invalid provider. Allowed: shopify, woocommerce, chariow, maketou, generic' }, { status: 400 })
    }
    if (!allowedEventsParsed.ok) {
        return NextResponse.json({ error: allowedEventsParsed.error }, { status: 400 })
    }

    const admin = createAdminClient()
    const ownsAgent = await ensureAgentOwnership(admin, user.id, agentId)
    if (!ownsAgent) {
        return NextResponse.json({ error: 'Agent not found or unauthorized' }, { status: 404 })
    }

    const nextMetadata = {
        ...metadata,
        ...(externalPlatformName ? { external_platform_name: externalPlatformName } : {}),
    }

    const signingSecret = `wsec_${randomBytes(24).toString('hex')}`

    let created: any = null
    let lastError: any = null
    for (let attempt = 0; attempt < 5; attempt++) {
        const webhookToken = `pwk_${randomBytes(20).toString('hex')}`
        const { data, error } = await admin
            .from('api_platform_connections')
            .insert({
                user_id: user.id,
                agent_id: agentId,
                name,
                provider,
                webhook_token: webhookToken,
                signing_secret: signingSecret,
                allowed_events: allowedEventsParsed.data,
                rate_limit_per_minute: rateLimit,
                is_active: isActive,
                metadata: nextMetadata,
            })
            .select('id, name, provider, agent_id, webhook_token, signing_secret, allowed_events, rate_limit_per_minute, is_active, last_received_at, last_status_code, last_error, metadata, created_at, updated_at')
            .single()

        if (!error && data) {
            created = data
            break
        }

        lastError = error
        if (error?.code !== '23505') {
            break
        }
    }

    if (!created) {
        const message = lastError?.message || 'Failed to create platform connection'
        return NextResponse.json({ error: message }, { status: 500 })
    }

    return NextResponse.json({
        data: {
            id: created.id,
            name: created.name,
            provider: created.provider,
            agent_id: created.agent_id,
            allowed_events: created.allowed_events,
            rate_limit_per_minute: created.rate_limit_per_minute,
            is_active: created.is_active,
            last_received_at: created.last_received_at,
            last_status_code: created.last_status_code,
            last_error: created.last_error,
            metadata: created.metadata,
            created_at: created.created_at,
            updated_at: created.updated_at,
            webhook_url: buildInboundUrl(request, created.webhook_token),
            signing_secret: created.signing_secret,
        }
    }, { status: 201 })
}
