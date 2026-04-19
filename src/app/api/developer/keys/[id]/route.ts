import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'

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

// PATCH /api/developer/keys/[id] - rename, activate/deactivate, adjust limits and agent scope
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

    const { data: key } = await admin
        .from('api_keys')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!key) {
        return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const updates: Record<string, any> = {}

    if (typeof body.is_active === 'boolean') {
        updates.is_active = body.is_active
    }

    if (typeof body.name === 'string' && body.name.trim()) {
        updates.name = body.name.trim()
    }

    if (typeof body.rate_limit_per_minute === 'number') {
        updates.rate_limit_per_minute = Math.min(Math.max(1, body.rate_limit_per_minute), 1000)
    }

    if ('allowed_agent_ids' in body) {
        const scopedAgents = await normalizeAllowedAgentIds(admin, user.id, body.allowed_agent_ids)
        if (scopedAgents.error) {
            return scopedAgents.error
        }
        updates.allowed_agent_ids = scopedAgents.data
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await admin
        .from('api_keys')
        .update(updates)
        .eq('id', id)
        .select('id, name, key_prefix, environment, is_active, rate_limit_per_minute, allowed_agent_ids, last_used_at, created_at, expires_at')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: updated })
}

// DELETE /api/developer/keys/[id] - permanently delete a key
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

    const { data: key } = await admin
        .from('api_keys')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (!key) {
        return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    const { error } = await admin
        .from('api_keys')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
