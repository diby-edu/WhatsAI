import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'
import { createHash, randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

async function normalizeAllowedAgentIds(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    allowedAgentIds: unknown
) {
    if (allowedAgentIds == null) {
        return { data: null as string[] | null }
    }

    if (!Array.isArray(allowedAgentIds)) {
        return {
            error: NextResponse.json(
                { error: 'allowed_agent_ids must be an array of agent ids or null' },
                { status: 400 }
            )
        }
    }

    const normalized = [...new Set(
        allowedAgentIds
            .filter((value): value is string => typeof value === 'string')
            .map(value => value.trim())
            .filter(Boolean)
    )]

    if (normalized.length === 0) {
        return { data: null as string[] | null }
    }

    const { data, error } = await admin
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .in('id', normalized)

    if (error) {
        return {
            error: NextResponse.json({ error: error.message }, { status: 500 })
        }
    }

    if ((data?.length ?? 0) !== normalized.length) {
        return {
            error: NextResponse.json(
                { error: 'One or more allowed_agent_ids do not belong to this user' },
                { status: 400 }
            )
        }
    }

    return { data: normalized }
}

// GET /api/developer/keys - list API keys for the authenticated user
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
        .from('api_keys')
        .select('id, name, key_prefix, environment, is_active, rate_limit_per_minute, allowed_agent_ids, last_used_at, created_at, expires_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
}

// POST /api/developer/keys - create a new API key
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
        name,
        environment = 'live',
        rate_limit_per_minute = 60,
        allowed_agent_ids = null,
        expires_at = null,
    } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Missing or invalid field: name' }, { status: 400 })
    }

    if (!['live', 'test'].includes(environment)) {
        return NextResponse.json({ error: 'environment must be "live" or "test"' }, { status: 400 })
    }

    const admin = createAdminClient()
    const scopedAgents = await normalizeAllowedAgentIds(admin, user.id, allowed_agent_ids)

    if (scopedAgents.error) {
        return scopedAgents.error
    }

    // Max 10 active keys per account
    const { count } = await admin
        .from('api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)

    if ((count ?? 0) >= 10) {
        return NextResponse.json({ error: 'Maximum 10 active API keys per account' }, { status: 400 })
    }

    // Generate raw key once and store only the hash
    const prefix = environment === 'test' ? 'sk_test_' : 'sk_live_'
    const rawKey = `${prefix}${randomBytes(32).toString('hex')}`
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.slice(0, 12)

    const { data: newKey, error } = await admin
        .from('api_keys')
        .insert({
            user_id: user.id,
            name: name.trim(),
            key_hash: keyHash,
            key_prefix: keyPrefix,
            environment,
            rate_limit_per_minute: Math.min(Math.max(1, Number(rate_limit_per_minute) || 60), 1000),
            allowed_agent_ids: scopedAgents.data,
            expires_at: expires_at || null,
        })
        .select('id, name, key_prefix, environment, is_active, rate_limit_per_minute, allowed_agent_ids, created_at, expires_at')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        data: { ...newKey, raw_key: rawKey }
    }, { status: 201 })
}
