import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/api-utils'
import { checkPublicApiAccessForUser } from '@/lib/api/public-auth'
import { checkPublicRateLimit } from '@/lib/api/rate-limit-public'
import { checkIdempotency, storeIdempotency } from '@/lib/api/idempotency'
import { buildTriggerMessage, type TriggerContext } from '@/lib/api/trigger-templates'
import { queuePublicAssistantMessage } from '@/lib/api/public-whatsapp'
import {
    detectProviderEventForFixedProvider,
    normalizeProvider,
    normalizeWebhookEvent,
} from '@/lib/api/platform-webhook-normalizer'
import { verifyIncomingWebhookSignature } from '@/lib/api/platform-webhook-security'
import { normalizePhone, isValidPhone, asString } from '@/lib/api/shared'
import { logApiUsage } from '@/lib/api/log-usage'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createAdminClient()

function asObject(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    return value as Record<string, unknown>
}

function buildDeliveryId(headers: Headers, body: Record<string, unknown>, fallback?: string): string | null {
    const headerDeliveryId =
        headers.get('x-shopify-webhook-id')
        || headers.get('x-shopify-event-id')
        || headers.get('x-wc-webhook-delivery-id')
        || headers.get('x-webhook-id')

    const bodyDeliveryId =
        asString(body.delivery_id)
        || asString(body.webhook_id)
        || asString(body.event_id)
        || asString(body.id)

    const raw = headerDeliveryId || bodyDeliveryId || fallback
    if (!raw) return null
    return raw.trim().slice(0, 180)
}

function eventAllowed(allowedEvents: unknown, providerEvent: string, triggerEvent: string): boolean {
    if (!Array.isArray(allowedEvents) || allowedEvents.length === 0) return true
    const normalized = new Set(
        allowedEvents
            .filter((event): event is string => typeof event === 'string')
            .map(event => event.trim().toLowerCase())
            .filter(Boolean)
    )
    if (normalized.size === 0) return true
    return normalized.has(providerEvent.toLowerCase()) || normalized.has(triggerEvent.toLowerCase())
}

function short(value: string | null | undefined, max = 120): string {
    const next = String(value || '').trim()
    if (!next) return 'n/a'
    return next.length > max ? `${next.slice(0, max)}...` : next
}

async function updateConnectionStatus(connectionId: string, statusCode: number, error: string | null = null) {
    await supabaseAdmin
        .from('api_platform_connections')
        .update({
            last_received_at: new Date().toISOString(),
            last_status_code: statusCode,
            last_error: error,
        })
        .eq('id', connectionId)
}

// POST /api/public/v1/incoming/[token]
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params
    const startTime = Date.now()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || null

    if (!token || token.length < 12) {
        return NextResponse.json({ error: 'Invalid webhook token', code: 'INVALID_TOKEN' }, { status: 400 })
    }

    const rawBody = await request.text()
    console.log(`[INCOMING][DEBUG] token=${token.slice(0, 12)}... body=${rawBody.slice(0, 2000)}`)
    if (!rawBody || rawBody.trim().length === 0) {
        return NextResponse.json(
            {
                success: true,
                ignored: true,
                reason: 'empty_body_probe',
            },
            { status: 200 }
        )
    }

    let body: Record<string, unknown>
    try {
        body = asObject(JSON.parse(rawBody))
    } catch {
        try {
            const formBody = new URLSearchParams(rawBody)
            const payload = formBody.get('payload')
            if (payload) {
                body = asObject(JSON.parse(payload))
            } else {
                body = Object.fromEntries(formBody.entries())
            }
        } catch {
            return NextResponse.json(
                {
                    success: true,
                    ignored: true,
                    reason: 'invalid_json_probe',
                },
                { status: 200 }
            )
        }
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
        .from('api_platform_connections')
        .select('id, user_id, agent_id, provider, signing_secret, allowed_events, rate_limit_per_minute, is_active')
        .eq('webhook_token', token)
        .maybeSingle()

    if (connectionError) {
        return NextResponse.json({ error: connectionError.message, code: 'LOOKUP_FAILED' }, { status: 500 })
    }

    if (!connection || !connection.is_active) {
        return NextResponse.json({ error: 'Webhook connection not found or inactive', code: 'NOT_FOUND' }, { status: 404 })
    }

    const access = await checkPublicApiAccessForUser(connection.user_id)
    if (!access.allowed) {
        await updateConnectionStatus(connection.id, access.status || 403, access.error || 'Public API access denied')
        return NextResponse.json({ error: access.error, code: 'ACCESS_DENIED' }, { status: access.status || 403 })
    }

    const provider = normalizeProvider(connection.provider)
    const payload = Object.keys(asObject(body.payload)).length > 0
        ? asObject(body.payload)
        : body
    const providerEvent = detectProviderEventForFixedProvider(provider, request.headers, body)
    const normalized = normalizeWebhookEvent(provider, providerEvent, payload)
    const deliveryId = buildDeliveryId(request.headers, body, normalized.idempotencyHint)

    const signatureContext = `topic=${providerEvent}; delivery_id=${deliveryId || 'none'}; ua=${short(request.headers.get('user-agent'))}; ct=${short(request.headers.get('content-type'))}`
    const signatureCheck = verifyIncomingWebhookSignature({
        provider,
        headers: request.headers,
        rawBody,
        signingSecret: connection.signing_secret,
    })

    if (!signatureCheck.valid) {
        const normalizedPhonePreview = normalized.customer.phone ? normalizePhone(normalized.customer.phone) : null
        const hasValidPhonePreview = !!(normalizedPhonePreview && isValidPhone(normalizedPhonePreview))

        const isUnsignedWooProbe =
            provider === 'woocommerce'
            && signatureCheck.reason === 'Missing X-WC-Webhook-Signature header'
            && !hasValidPhonePreview

        if (isUnsignedWooProbe) {
            const message = `Ignored unsigned Woo probe | ${signatureContext}`
            console.warn(`[INCOMING][PROBE] ${message}`)
            await updateConnectionStatus(connection.id, 200, message)
            return NextResponse.json(
                {
                    success: true,
                    ignored: true,
                    reason: 'unsigned_woo_probe',
                    data: {
                        provider,
                        provider_event: providerEvent,
                        trigger_event: normalized.triggerEvent,
                    },
                },
                { status: 200 }
            )
        }

        const errorMessage = `${signatureCheck.reason || 'Invalid signature'} | ${signatureContext}`
        console.error(`[INCOMING][SIGNATURE] ${errorMessage}`)
        await updateConnectionStatus(connection.id, 401, errorMessage)
        return NextResponse.json(
            {
                error: signatureCheck.reason || 'Invalid webhook signature',
                code: 'INVALID_SIGNATURE',
            },
            { status: 401 }
        )
    }

    if (!eventAllowed(connection.allowed_events, providerEvent, normalized.triggerEvent)) {
        await updateConnectionStatus(connection.id, 202, `Ignored event: ${providerEvent}`)
        return NextResponse.json(
            {
                success: true,
                ignored: true,
                reason: 'event_not_allowed',
                data: {
                    provider,
                    provider_event: providerEvent,
                    trigger_event: normalized.triggerEvent,
                },
            },
            { status: 202 }
        )
    }

    const normalizedPhone = normalized.customer.phone ? normalizePhone(normalized.customer.phone) : null
    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
        await updateConnectionStatus(connection.id, 202, null)
        return NextResponse.json(
            {
                success: true,
                ignored: true,
                reason: 'invalid_phone',
                data: {
                    provider,
                    provider_event: providerEvent,
                    trigger_event: normalized.triggerEvent,
                },
            },
            { status: 202 }
        )
    }

    const rateCheck = await checkPublicRateLimit(
        `platform_conn_${connection.id}`,
        connection.user_id,
        normalizedPhone,
        connection.rate_limit_per_minute || 300
    )
    if (!rateCheck.allowed) {
        await updateConnectionStatus(connection.id, 429, rateCheck.reason || 'Rate limit reached')
        logApiUsage(supabaseAdmin, {
            userId: connection.user_id,
            agentId: connection.agent_id,
            endpoint: '/api/public/v1/incoming',
            method: 'POST',
            statusCode: 429,
            requestBody: { provider, event: providerEvent, phone: normalizedPhone, connection_id: connection.id },
            responseMs: Date.now() - startTime,
            ipAddress: ip,
        })
        return NextResponse.json(
            { error: rateCheck.reason, code: 'RATE_LIMIT' },
            { status: 429, headers: rateCheck.headers }
        )
    }

    const explicitIdempotency = asString(body.idempotency_key)
    const hashSuffix = createHash('sha256').update(rawBody).digest('hex').slice(0, 20)
    const idempotencyKey = (
        explicitIdempotency
        || (deliveryId ? `in_${connection.id}_${providerEvent}_${deliveryId}` : `in_${connection.id}_${providerEvent}_${hashSuffix}`)
    ).slice(0, 180)

    const cached = await checkIdempotency(supabaseAdmin, connection.user_id, idempotencyKey)
    if (cached) {
        await updateConnectionStatus(connection.id, 200, null)
        return NextResponse.json(cached, {
            status: 200,
            headers: {
                ...rateCheck.headers,
                'X-Idempotent-Replayed': 'true',
            },
        })
    }

    const { data: agent, error: agentError } = await supabaseAdmin
        .from('agents')
        .select('id, user_id, is_active, whatsapp_connected')
        .eq('id', connection.agent_id)
        .maybeSingle()

    if (agentError) {
        await updateConnectionStatus(connection.id, 500, agentError.message)
        return NextResponse.json({ error: agentError.message, code: 'AGENT_LOOKUP_FAILED' }, { status: 500 })
    }
    if (!agent || agent.user_id !== connection.user_id) {
        await updateConnectionStatus(connection.id, 404, 'Agent not found or unauthorized')
        return NextResponse.json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' }, { status: 404 })
    }
    if (!agent.is_active) {
        await updateConnectionStatus(connection.id, 400, 'Agent is paused')
        return NextResponse.json({ error: 'Agent is paused', code: 'AGENT_INACTIVE' }, { status: 400 })
    }
    if (!agent.whatsapp_connected) {
        await updateConnectionStatus(connection.id, 400, 'Agent not connected to WhatsApp')
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
        source: 'platform_webhook_incoming',
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
        agentId: connection.agent_id,
        userId: connection.user_id,
        phone: normalizedPhone,
        message: generatedMessage,
        mediaUrl: normalized.mediaUrl,
        mediaType: normalized.mediaType,
        conversationMetadata: { external_context: externalContext },
        messageMetadata: {
            source: 'platform_webhook_incoming',
            provider,
            provider_event: providerEvent,
            delivery_id: deliveryId || null,
            signature_mode: signatureCheck.mode,
        },
    })

    if (!queueResult.queued) {
        await updateConnectionStatus(connection.id, 500, 'Failed to queue outbound message')
        logApiUsage(supabaseAdmin, {
            userId: connection.user_id,
            agentId: connection.agent_id,
            endpoint: '/api/public/v1/incoming',
            method: 'POST',
            statusCode: 500,
            requestBody: { provider, event: providerEvent, phone: normalizedPhone, connection_id: connection.id },
            responseMs: Date.now() - startTime,
            ipAddress: ip,
        })
        return NextResponse.json(
            { error: 'Failed to queue message', code: 'QUEUE_FAILED' },
            { status: 500, headers: rateCheck.headers }
        )
    }

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

    storeIdempotency(supabaseAdmin, connection.user_id, idempotencyKey, responseBody)
    await updateConnectionStatus(connection.id, 200, null)
    logApiUsage(supabaseAdmin, {
        userId: connection.user_id,
        agentId: connection.agent_id,
        endpoint: '/api/public/v1/incoming',
        method: 'POST',
        statusCode: 200,
        requestBody: { provider, event: providerEvent, phone: normalizedPhone, connection_id: connection.id },
        responseMs: Date.now() - startTime,
        ipAddress: ip,
    })

    return NextResponse.json(responseBody, { status: 200, headers: rateCheck.headers })
}
