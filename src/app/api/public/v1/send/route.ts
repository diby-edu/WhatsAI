import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, isAgentAllowed } from '@/lib/api/public-auth'
import { checkPublicRateLimit } from '@/lib/api/rate-limit-public'
import { logApiUsage } from '@/lib/api/log-usage'
import { checkIdempotency, storeIdempotency } from '@/lib/api/idempotency'
import { sendMessageViaInternalBot } from '@/lib/whatsapp/internal-bot'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (phone.startsWith('+')) return `+${digits}`
    if (digits.length >= 10) return `+${digits}`
    return phone
}

function isValidPhone(phone: string): boolean {
    return /^\+\d{8,15}$/.test(phone)
}

async function saveConversationAndMessage(params: {
    agentId: string
    userId: string
    phone: string
    message: string
    messageId: string | null
    externalContext: any
    metadata: any
}): Promise<string | null> {
    const { agentId, userId, phone, message, messageId, externalContext, metadata } = params

    const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('id, metadata')
        .eq('agent_id', agentId)
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const convMetadata = externalContext
        ? { ...(existingConv?.metadata || metadata), external_context: externalContext }
        : (metadata || null)

    let conversationId: string | null = null

    if (existingConv) {
        conversationId = existingConv.id
        if (externalContext) {
            await supabaseAdmin.from('conversations').update({ metadata: convMetadata }).eq('id', existingConv.id)
        }
    } else {
        const { data: newConv } = await supabaseAdmin
            .from('conversations')
            .insert({ agent_id: agentId, user_id: userId, customer_phone: phone, status: 'active', metadata: convMetadata })
            .select('id')
            .single()
        conversationId = newConv?.id || null
    }

    if (conversationId) {
        await supabaseAdmin.from('messages').insert({
            conversation_id: conversationId,
            agent_id: agentId,
            role: 'assistant',
            content: message,
            whatsapp_message_id: messageId,
            status: 'sent',
            metadata: { source: 'api', ...metadata },
        })
    }

    return conversationId
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    // ── Auth ──────────────────────────────────────────────────────────────
    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    // ── Parse body ────────────────────────────────────────────────────────
    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { agent_id, to, message, context: externalContext, idempotency_key, metadata } = body

    if (!agent_id || !to || !message) {
        return NextResponse.json({ error: 'Missing required fields: agent_id, to, message', code: 'BAD_REQUEST' }, { status: 400 })
    }

    // ── Idempotence ───────────────────────────────────────────────────────
    if (idempotency_key) {
        const cached = await checkIdempotency(supabaseAdmin, userId!, idempotency_key)
        if (cached) {
            return NextResponse.json(cached, { status: 200, headers: { 'X-Idempotent-Replayed': 'true' } })
        }
    }

    // ── Validation numéro ─────────────────────────────────────────────────
    const normalizedPhone = normalizePhone(String(to))
    if (!isValidPhone(normalizedPhone)) {
        return NextResponse.json({ error: 'Invalid phone number format. Use international format: +22507000000', code: 'INVALID_PHONE' }, { status: 400 })
    }

    // ── Rate limiting ─────────────────────────────────────────────────────
    const rateCheck = checkPublicRateLimit(apiKey!.id, userId!, normalizedPhone, apiKey!.rate_limit_per_minute)
    if (!rateCheck.allowed) {
        logApiUsage(supabaseAdmin, { apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id, endpoint: '/api/public/v1/send', method: 'POST', statusCode: 429, requestBody: body, responseMs: Date.now() - startTime, ipAddress: ip })
        return NextResponse.json({ error: rateCheck.reason, code: 'RATE_LIMIT' }, { status: 429, headers: rateCheck.headers })
    }

    // ── Vérifier agent ────────────────────────────────────────────────────
    const { data: agent } = await supabaseAdmin.from('agents').select('id, user_id, name, is_active, whatsapp_connected').eq('id', agent_id).single()

    if (!agent) return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    if (!isAgentAllowed(agent.user_id, userId!, agent_id, apiKey!.allowed_agent_ids ?? null)) return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    if (!agent.is_active) return NextResponse.json({ error: 'Agent is paused', code: 'AGENT_INACTIVE' }, { status: 400 })
    if (!agent.whatsapp_connected) return NextResponse.json({ error: 'Agent not connected to WhatsApp', code: 'AGENT_DISCONNECTED' }, { status: 400 })

    // ── Envoyer le message ────────────────────────────────────────────────
    const result = await sendMessageViaInternalBot({
        agentId: agent_id,
        to: normalizedPhone,
        message,
    })

    if (!result.success) {
        logApiUsage(supabaseAdmin, { apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id, endpoint: '/api/public/v1/send', method: 'POST', statusCode: 500, requestBody: body, responseMs: Date.now() - startTime, ipAddress: ip })
        return NextResponse.json({ error: result.error || 'Failed to send message', code: 'SEND_FAILED' }, { status: 500, headers: rateCheck.headers })
    }

    // ── Sauvegarder en DB ─────────────────────────────────────────────────
    let conversationId: string | null = null
    try {
        conversationId = await saveConversationAndMessage({ agentId: agent_id, userId: userId!, phone: normalizedPhone, message, messageId: result.messageId || null, externalContext, metadata })
    } catch (dbErr) {
        console.error('DB save error (non-blocking):', dbErr)
    }

    // ── Log + réponse ─────────────────────────────────────────────────────
    logApiUsage(supabaseAdmin, { apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id, endpoint: '/api/public/v1/send', method: 'POST', statusCode: 200, requestBody: body, responseMs: Date.now() - startTime, ipAddress: ip })

    const responseBody = {
        success: true,
        data: { message_id: result.messageId || null, conversation_id: conversationId, status: 'sent', sent_at: new Date().toISOString() }
    }

    if (idempotency_key) storeIdempotency(supabaseAdmin, userId!, idempotency_key, responseBody)

    return NextResponse.json(responseBody, { status: 200, headers: rateCheck.headers })
}
