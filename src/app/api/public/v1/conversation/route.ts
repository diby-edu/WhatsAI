import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/api-utils'
import { authenticateApiKey, isAgentAllowed } from '@/lib/api/public-auth'
import { checkPublicRateLimit } from '@/lib/api/rate-limit-public'
import { logApiUsage } from '@/lib/api/log-usage'
import { normalizePhone, isValidPhone } from '@/lib/api/shared'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createAdminClient()

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

    const rateCheck = await checkPublicRateLimit(apiKey!.id, userId!, null, apiKey!.rate_limit_per_minute)
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
        .select('id, agent_id, contact_phone, status, created_at, updated_at, metadata')
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

    const { contact_phone, ...conversationData } = conversation

    return NextResponse.json({
        success: true,
        data: {
            ...conversationData,
            customer_phone: contact_phone,
            messages: withMessages ? messages : undefined,
            message_count: messages.length
        }
    }, { status: 200, headers: rateCheck.headers })
}

// POST /api/public/v1/conversation
// Crée une conversation sans envoyer de message
export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    const rateCheck = await checkPublicRateLimit(apiKey!.id, userId!, null, apiKey!.rate_limit_per_minute)
    if (!rateCheck.allowed) {
        return NextResponse.json({ error: rateCheck.reason, code: 'RATE_LIMIT' }, { status: 429, headers: rateCheck.headers })
    }

    let body: any
    try { body = await request.json() } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { agent_id, customer_phone, metadata } = body
    if (!agent_id || !customer_phone) {
        return NextResponse.json({ error: 'Missing required fields: agent_id, customer_phone', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(String(customer_phone))
    if (!isValidPhone(normalizedPhone)) {
        return NextResponse.json({ error: 'Invalid phone number format. Use international format: +22507000000', code: 'INVALID_PHONE' }, { status: 400 })
    }

    const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, user_id, is_active')
        .eq('id', agent_id)
        .single()

    if (!agent) return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    if (!isAgentAllowed(agent.user_id, userId!, agent_id, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    // Chercher une conversation existante
    const { data: existing } = await supabaseAdmin
        .from('conversations')
        .select('id, status, created_at')
        .eq('agent_id', agent_id)
        .eq('contact_phone', normalizedPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (existing) {
        logApiUsage(supabaseAdmin, {
            apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
            endpoint: '/api/public/v1/conversation', method: 'POST',
            statusCode: 200, responseMs: Date.now() - startTime, ipAddress: ip
        })
        return NextResponse.json({
            success: true,
            data: { conversation_id: existing.id, status: existing.status, created: false }
        }, { status: 200, headers: rateCheck.headers })
    }

    // Créer une nouvelle conversation
    const { data: newConv, error } = await supabaseAdmin
        .from('conversations')
        .insert({
            agent_id,
            user_id: userId,
            contact_phone: normalizedPhone,
            status: 'active',
            metadata: metadata || null,
        })
        .select('id, status, created_at')
        .single()

    if (error || !newConv) {
        return NextResponse.json({ error: 'Failed to create conversation', code: 'CREATE_FAILED' }, { status: 500 })
    }

    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
        endpoint: '/api/public/v1/conversation', method: 'POST',
        statusCode: 201, responseMs: Date.now() - startTime, ipAddress: ip
    })

    return NextResponse.json({
        success: true,
        data: { conversation_id: newConv.id, status: newConv.status, created: true }
    }, { status: 201, headers: rateCheck.headers })
}

// PATCH /api/public/v1/conversation
// Changer le statut d'une conversation : active | paused | closed
export async function PATCH(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    let body: any
    try { body = await request.json() } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { conversation_id, status } = body
    if (!conversation_id || !status) {
        return NextResponse.json({ error: 'Missing required fields: conversation_id, status', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const VALID_STATUSES = ['active', 'paused', 'closed']
    if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({
            error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
            code: 'BAD_REQUEST'
        }, { status: 400 })
    }

    const { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('id, agent_id, status')
        .eq('id', conversation_id)
        .single()

    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, user_id')
        .eq('id', conversation.agent_id)
        .single()

    if (!agent || !isAgentAllowed(agent.user_id, userId!, conversation.agent_id, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Conversation not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    const { error: updateError } = await supabaseAdmin
        .from('conversations')
        .update({ status })
        .eq('id', conversation_id)

    if (updateError) {
        return NextResponse.json({ error: 'Failed to update conversation', code: 'UPDATE_FAILED' }, { status: 500 })
    }

    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId: conversation.agent_id,
        endpoint: '/api/public/v1/conversation', method: 'PATCH',
        statusCode: 200, responseMs: Date.now() - startTime, ipAddress: ip
    })

    return NextResponse.json({
        success: true,
        data: { conversation_id, status, previous_status: conversation.status }
    }, { status: 200 })
}
