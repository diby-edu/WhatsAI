import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/api-utils'
import { authenticateApiKey, isAgentAllowed } from '@/lib/api/public-auth'
import { logApiUsage } from '@/lib/api/log-usage'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createAdminClient()

export async function GET(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')

    if (!agentId) {
        return NextResponse.json({ error: 'Missing required parameter: agent_id', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, user_id, name, is_active, whatsapp_connected, whatsapp_phone, created_at')
        .eq('id', agentId)
        .single()

    if (!agent) {
        return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    }

    if (!isAgentAllowed(agent.user_id, userId!, agentId, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId,
        endpoint: '/api/public/v1/status', method: 'GET',
        statusCode: 200, responseMs: Date.now() - startTime, ipAddress: ip
    })

    return NextResponse.json({
        success: true,
        data: {
            agent_id: agent.id,
            name: agent.name,
            is_active: agent.is_active,
            whatsapp_connected: agent.whatsapp_connected ?? false,
            whatsapp_phone: agent.whatsapp_phone || null,
            status: !agent.is_active
                ? 'paused'
                : agent.whatsapp_connected
                    ? 'ready'
                    : 'disconnected',
        }
    }, { status: 200 })
}
