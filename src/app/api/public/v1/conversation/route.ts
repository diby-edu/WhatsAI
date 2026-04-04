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

// GET /api/public/v1/conversation?conversation_id=xxx
// Retourne le détail d'une conversation + ses messages
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
    const conversationId = searchParams.get('conversation_id')
    const withMessages   = searchParams.get('messages') !== 'false'
    const msgLimit       = Math.min(parseInt(searchParams.get('msg_limit') || '50'), 200)

    if (!conversationId) {
        return NextResponse.json({ error: 'Missing required parameter: conversation_id', code: 'BAD_REQUEST' }, { status: 400 })
    }

    // Récupérer la conversation + vérifier ownership
    const { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('id, agent_id, customer_phone, status, created_at, updated_at, metadata')
        .eq('id', conversationId)
        .single()

    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    // Vérifier que l'agent appartient à cet utilisateur
    const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, user_id')
        .eq('id', conversation.agent_id)
        .single()

    if (!agent || !isAgentAllowed(agent.user_id, userId!, conversation.agent_id, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Conversation not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    let messages: any[] = []
    if (withMessages) {
        const { data: msgs } = await supabaseAdmin
            .from('messages')
            .select('id, role, content, created_at, status, whatsapp_message_id')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .limit(msgLimit)

        messages = msgs || []
    }

    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId: conversation.agent_id,
        endpoint: '/api/public/v1/conversation', method: 'GET',
        statusCode: 200, responseMs: Date.now() - startTime, ipAddress: ip
    })

    return NextResponse.json({
        success: true,
        data: {
            ...conversation,
            messages: withMessages ? messages : undefined,
            message_count: messages.length
        }
    }, { status: 200, headers: rateCheck.headers })
}
