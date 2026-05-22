import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

function asString(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const next = value.trim()
    return next.length > 0 ? next : null
}

// GET /api/developer/synced-products?agent_id=xxx
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = asString(request.nextUrl.searchParams.get('agent_id'))

    const admin = createAdminClient()
    let query = admin
        .from('agent_external_data')
        .select('id, agent_id, external_id, data, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('data_type', 'product')
        .order('created_at', { ascending: false })
        .limit(200)

    if (agentId) {
        query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
}
