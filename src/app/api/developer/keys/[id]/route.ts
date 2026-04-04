import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// PATCH /api/developer/keys/[id] — renommer, activer/désactiver, modifier les limites
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

    // Vérifier la propriété avant toute modification
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
    try { body = await request.json() } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const updates: Record<string, any> = {}
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
    if (typeof body.rate_limit_per_minute === 'number') {
        updates.rate_limit_per_minute = Math.min(Math.max(1, body.rate_limit_per_minute), 1000)
    }
    if ('allowed_agent_ids' in body) updates.allowed_agent_ids = body.allowed_agent_ids || null

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

// DELETE /api/developer/keys/[id] — supprime définitivement
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
