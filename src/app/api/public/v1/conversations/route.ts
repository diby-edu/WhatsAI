import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, isAgentAllowed } from '@/lib/api/public-auth'
import { checkPublicRateLimit } from '@/lib/api/rate-limit-public'
import { logApiUsage } from '@/lib/api/log-usage'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    const rateCheck = checkPublicRateLimit(apiKey!.id, userId!, null, apiKey!.rate_limit_per_minute)
    if (!rateCheck.allowed) {
        return NextResponse.json({ error: rateCheck.reason, code: 'RATE_LIMIT' }, { status: 429, headers: rateCheck.headers })
    }

    const { searchParams } = new URL(request.url)
    const agentId   = searchParams.get('agent_id')
    const phone     = searchParams.get('phone')
    const status    = searchParams.get('status')          // active | closed
    const limit     = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset    = parseInt(searchParams.get('offset') || '0')

    if (!agentId) {
        return NextResponse.json({ error: 'Missing required parameter: agent_id', code: 'BAD_REQUEST' }, { status: 400 })
    }

    // Vérifier que l'agent appartient à cet utilisateur
    const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, user_id')
        .eq('id', agentId)
        .single()

    if (!agent) return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    if (!isAgentAllowed(agent.user_id, userId!, agentId, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    let query = supabaseAdmin
        .from('conversations')
        .select('id, customer_phone, status, created_at, updated_at, metadata', { count: 'exact' })
        .eq('agent_id', agentId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (phone) query = query.eq('customer_phone', phone)
    if (status) query = query.eq('status', status)

    const { data: conversations, error, count } = await query

    if (error) {
        return NextResponse.json({ error: 'Database error', code: 'SERVER_ERROR' }, { status: 500 })
    }

    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId,
        endpoint: '/api/public/v1/conversations', method: 'GET',
        statusCode: 200, responseMs: Date.now() - startTime, ipAddress: ip
    })

    return NextResponse.json({
        success: true,
        data: conversations || [],
        pagination: { total: count || 0, limit, offset, has_more: (offset + limit) < (count || 0) }
    }, { status: 200, headers: rateCheck.headers })
}
