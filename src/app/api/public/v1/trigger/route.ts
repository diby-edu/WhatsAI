import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, isAgentAllowed } from '@/lib/api/public-auth'
import { checkPublicRateLimit } from '@/lib/api/rate-limit-public'
import { logApiUsage } from '@/lib/api/log-usage'
import { checkIdempotency, storeIdempotency } from '@/lib/api/idempotency'
import { buildTriggerMessage, type TriggerContext } from '@/lib/api/trigger-templates'
import { queuePublicAssistantMessage } from '@/lib/api/public-whatsapp'

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

function asObject(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { agent_id, event, customer, cart, order, appointment, data, message, idempotency_key, metadata } = body

    if (!agent_id || !event || !customer?.phone) {
        return NextResponse.json({
            error: 'Missing required fields: agent_id, event, customer.phone',
            code: 'BAD_REQUEST',
        }, { status: 400 })
    }

    if (idempotency_key) {
        const cached = await checkIdempotency(supabaseAdmin, userId!, idempotency_key)
        if (cached) {
            return NextResponse.json(cached, {
                status: 200,
                headers: { 'X-Idempotent-Replayed': 'true' },
            })
        }
    }

    const normalizedPhone = normalizePhone(String(customer.phone))
    if (!isValidPhone(normalizedPhone)) {
        return NextResponse.json({
            error: 'Invalid phone number format. Use international format: +22507000000',
            code: 'INVALID_PHONE',
        }, { status: 400 })
    }

    const rateCheck = checkPublicRateLimit(apiKey!.id, userId!, normalizedPhone, apiKey!.rate_limit_per_minute)
    if (!rateCheck.allowed) {
        logApiUsage(supabaseAdmin, {
            apiKeyId: apiKey!.id,
            userId: userId!,
            agentId: agent_id,
            endpoint: '/api/public/v1/trigger',
            method: 'POST',
            statusCode: 429,
            requestBody: body,
            responseMs: Date.now() - startTime,
            ipAddress: ip,
        })
        return NextResponse.json(
            { error: rateCheck.reason, code: 'RATE_LIMIT' },
            { status: 429, headers: rateCheck.headers }
        )
    }

    const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, user_id, name, is_active, whatsapp_connected, whatsapp_status')
        .eq('id', agent_id)
        .single()

    if (!agent) {
        return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    }

    if (!isAgentAllowed(agent.user_id, userId!, agent_id, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    if (!agent.is_active) {
        return NextResponse.json({ error: 'Agent is paused', code: 'AGENT_INACTIVE' }, { status: 400 })
    }

    if (!agent.whatsapp_connected) {
        return NextResponse.json({ error: 'Agent not connected to WhatsApp', code: 'AGENT_DISCONNECTED' }, { status: 400 })
    }

    const triggerContext: TriggerContext = {
        event,
        customer: { ...customer, phone: normalizedPhone },
        cart,
        order,
        appointment,
        data,
        message,
    }

    const generatedMessage = buildTriggerMessage(triggerContext)
    const metadataObject = asObject(metadata)

    const queueResult = await queuePublicAssistantMessage({
        supabase: supabaseAdmin,
        agentId: agent_id,
        userId: userId!,
        phone: normalizedPhone,
        message: generatedMessage,
        conversationMetadata: { external_context: triggerContext },
        messageMetadata: { source: 'trigger', event, ...(metadataObject || {}) },
    })

    if (!queueResult.queued) {
        logApiUsage(supabaseAdmin, {
            apiKeyId: apiKey!.id,
            userId: userId!,
            agentId: agent_id,
            endpoint: '/api/public/v1/trigger',
            method: 'POST',
            statusCode: 500,
            requestBody: body,
            responseMs: Date.now() - startTime,
            ipAddress: ip,
        })
        return NextResponse.json(
            { error: 'Failed to queue message', code: 'QUEUE_FAILED' },
            { status: 500, headers: rateCheck.headers }
        )
    }

    const responseMs = Date.now() - startTime
    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id,
        userId: userId!,
        agentId: agent_id,
        endpoint: '/api/public/v1/trigger',
        method: 'POST',
        statusCode: 200,
        requestBody: body,
        responseMs,
        ipAddress: ip,
    })

    const responseBody = {
        success: true,
        data: {
            message_id: null,
            conversation_id: queueResult.conversationId,
            event,
            message_sent: generatedMessage,
            status: 'queued',
            queued: true,
            queued_at: new Date().toISOString(),
        },
    }

    if (idempotency_key) {
        storeIdempotency(supabaseAdmin, userId!, idempotency_key, responseBody)
    }

    return NextResponse.json(responseBody, { status: 200, headers: rateCheck.headers })
}
