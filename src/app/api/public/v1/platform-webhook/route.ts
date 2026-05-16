import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, isAgentAllowed } from '@/lib/api/public-auth'
import { checkPublicRateLimit } from '@/lib/api/rate-limit-public'
import { logApiUsage } from '@/lib/api/log-usage'
import { checkIdempotency, storeIdempotency } from '@/lib/api/idempotency'
import { buildTriggerMessage, type TriggerContext } from '@/lib/api/trigger-templates'
import { queuePublicAssistantMessage } from '@/lib/api/public-whatsapp'
import { detectProviderFromRequest, normalizeWebhookEvent } from '@/lib/api/platform-webhook-normalizer'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function asObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

function asString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const next = value.trim()
    return next.length > 0 ? next : undefined
}

function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (phone.startsWith('+')) return `+${digits}`
    if (digits.length >= 10) return `+${digits}`
    return phone
}

function isValidPhone(phone: string): boolean {
    return /^\+\d{8,15}$/.test(phone)
}

function buildDeliveryId(request: NextRequest, body: Record<string, unknown>, fallback?: string): string | null {
    const headerDeliveryId =
        request.headers.get('x-shopify-webhook-id')
        || request.headers.get('x-shopify-event-id')
        || request.headers.get('x-wc-webhook-delivery-id')
        || request.headers.get('x-webhook-id')

    const bodyDeliveryId =
        asString(body.delivery_id)
        || asString(body.webhook_id)
        || asString(body.event_id)
        || asString(body.id)

    const raw = headerDeliveryId || bodyDeliveryId || fallback
    if (!raw) return null
    return raw.trim().slice(0, 180)
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    const auth = await authenticateApiKey(request, supabaseAdmin)
    if (auth.error) {
        return NextResponse.json({ error: auth.error, code: 'UNAUTHORIZED' }, { status: auth.status })
    }
    const { apiKey, userId } = auth

    let body: Record<string, unknown>
    try {
        body = asObject(await request.json())
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const agentId = asString(body.agent_id) || request.nextUrl.searchParams.get('agent_id') || ''
    if (!agentId) {
        return NextResponse.json({ error: 'Missing required field: agent_id', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const payload = Object.keys(asObject(body.payload)).length > 0
        ? asObject(body.payload)
        : body

    const { provider, providerEvent } = detectProviderFromRequest(request.headers, body)
    const normalized = normalizeWebhookEvent(provider, providerEvent, payload)
    const deliveryId = buildDeliveryId(request, body, normalized.idempotencyHint)
    const idempotencyKeyRaw =
        asString(body.idempotency_key)
        || (deliveryId ? `wh_${provider}_${providerEvent}_${deliveryId}` : undefined)
    const idempotencyKey = idempotencyKeyRaw ? idempotencyKeyRaw.slice(0, 180) : undefined

    if (idempotencyKey) {
        const cached = await checkIdempotency(supabaseAdmin, userId!, idempotencyKey)
        if (cached) {
            return NextResponse.json(cached, {
                status: 200,
                headers: { 'X-Idempotent-Replayed': 'true' },
            })
        }
    }

    const normalizedPhone = normalized.customer.phone ? normalizePhone(normalized.customer.phone) : null
    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
        return NextResponse.json({
            error: 'Unable to map a valid customer phone from webhook payload',
            code: 'INVALID_PHONE',
            details: {
                provider,
                provider_event: providerEvent,
            },
        }, { status: 400 })
    }

    const rateCheck = await checkPublicRateLimit(apiKey!.id, userId!, normalizedPhone, apiKey!.rate_limit_per_minute)
    if (!rateCheck.allowed) {
        logApiUsage(supabaseAdmin, {
            apiKeyId: apiKey!.id,
            userId: userId!,
            agentId,
            endpoint: '/api/public/v1/platform-webhook',
            method: 'POST',
            statusCode: 429,
            requestBody: {
                provider,
                provider_event: providerEvent,
                idempotency_key: idempotencyKey || null,
            },
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
        .select('id, user_id, is_active, whatsapp_connected')
        .eq('id', agentId)
        .single()

    if (!agent) {
        return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    }

    if (!isAgentAllowed(agent.user_id, userId!, agentId, apiKey!.allowed_agent_ids ?? null)) {
        return NextResponse.json({ error: 'Agent not authorized for this API key', code: 'UNAUTHORIZED_AGENT' }, { status: 403 })
    }

    if (!agent.is_active) {
        return NextResponse.json({ error: 'Agent is paused', code: 'AGENT_INACTIVE' }, { status: 400 })
    }

    if (!agent.whatsapp_connected) {
        return NextResponse.json({ error: 'Agent not connected to WhatsApp', code: 'AGENT_DISCONNECTED' }, { status: 400 })
    }

    const messageOverride =
        asString(body.message)
        || asString(payload.message)
        || asString(payload.custom_message)

    const triggerContext: TriggerContext = {
        event: normalized.triggerEvent,
        customer: {
            name: normalized.customer.name,
            phone: normalizedPhone,
            email: normalized.customer.email,
        },
        order: normalized.order,
        cart: normalized.cart,
        data: normalized.data,
        message: messageOverride,
    }

    const generatedMessage = buildTriggerMessage(triggerContext)
    const externalContext = {
        source: 'platform_webhook',
        provider,
        provider_event: providerEvent,
        trigger_event: normalized.triggerEvent,
        delivery_id: deliveryId,
        customer: {
            name: normalized.customer.name || null,
            phone: normalizedPhone,
            email: normalized.customer.email || null,
        },
        order: normalized.order || null,
        cart: normalized.cart || null,
    }

    const queueResult = await queuePublicAssistantMessage({
        supabase: supabaseAdmin,
        agentId,
        userId: userId!,
        phone: normalizedPhone,
        message: generatedMessage,
        conversationMetadata: { external_context: externalContext },
        messageMetadata: {
            source: 'platform_webhook',
            provider,
            provider_event: providerEvent,
            delivery_id: deliveryId || null,
        },
    })

    if (!queueResult.queued) {
        logApiUsage(supabaseAdmin, {
            apiKeyId: apiKey!.id,
            userId: userId!,
            agentId,
            endpoint: '/api/public/v1/platform-webhook',
            method: 'POST',
            statusCode: 500,
            requestBody: {
                provider,
                provider_event: providerEvent,
                idempotency_key: idempotencyKey || null,
            },
            responseMs: Date.now() - startTime,
            ipAddress: ip,
        })
        return NextResponse.json(
            { error: 'Failed to queue message', code: 'QUEUE_FAILED' },
            { status: 500, headers: rateCheck.headers }
        )
    }

    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id,
        userId: userId!,
        agentId,
        endpoint: '/api/public/v1/platform-webhook',
        method: 'POST',
        statusCode: 200,
        requestBody: {
            provider,
            provider_event: providerEvent,
            idempotency_key: idempotencyKey || null,
        },
        responseMs: Date.now() - startTime,
        ipAddress: ip,
    })

    const responseBody = {
        success: true,
        data: {
            provider,
            provider_event: providerEvent,
            trigger_event: normalized.triggerEvent,
            message_id: null,
            conversation_id: queueResult.conversationId,
            status: 'queued',
            queued: true,
            queued_at: new Date().toISOString(),
        },
    }

    if (idempotencyKey) {
        storeIdempotency(supabaseAdmin, userId!, idempotencyKey, responseBody)
    }

    return NextResponse.json(responseBody, { status: 200, headers: rateCheck.headers })
}
