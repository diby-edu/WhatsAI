import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateApiKey, isAgentAllowed } from '@/lib/api/public-auth'
import { checkPublicRateLimit } from '@/lib/api/rate-limit-public'
import { logApiUsage } from '@/lib/api/log-usage'
import { checkIdempotency, storeIdempotency } from '@/lib/api/idempotency'
import { buildTriggerMessage, type TriggerContext } from '@/lib/api/trigger-templates'
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

/**
 * POST /api/public/v1/trigger
 *
 * Déclenche une conversation via un événement métier typé.
 * Génère automatiquement le message depuis un template.
 * Supporte l'idempotence via idempotency_key.
 *
 * Body:
 *   agent_id        string   (requis)
 *   event           string   (requis) — cart_abandoned | order_created | order_shipped | payment_failed | appointment_reminder | welcome | custom
 *   customer        object   (requis) — { phone: string, name?: string }
 *   cart            object?  — { items, total, currency }
 *   order           object?  — { id, reference, total, status, tracking_url }
 *   appointment     object?  — { date, time, location, professional }
 *   data            object?  — champs libres injectés dans le contexte agent
 *   message         string?  — surcharge le template si fourni
 *   idempotency_key string?  — clé unique pour éviter les doublons (TTL 24h)
 *   metadata        object?  — métadonnées libres stockées en DB
 */
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

    const { agent_id, event, customer, cart, order, appointment, data, message, idempotency_key, metadata } = body

    if (!agent_id || !event || !customer?.phone) {
        return NextResponse.json({
            error: 'Missing required fields: agent_id, event, customer.phone',
            code: 'BAD_REQUEST'
        }, { status: 400 })
    }

    // ── Idempotence ───────────────────────────────────────────────────────
    if (idempotency_key) {
        const cached = await checkIdempotency(supabaseAdmin, userId!, idempotency_key)
        if (cached) {
            return NextResponse.json(cached, {
                status: 200,
                headers: { 'X-Idempotent-Replayed': 'true' }
            })
        }
    }

    // ── Validation numéro ─────────────────────────────────────────────────
    const normalizedPhone = normalizePhone(String(customer.phone))
    if (!isValidPhone(normalizedPhone)) {
        return NextResponse.json({
            error: 'Invalid phone number format. Use international format: +22507000000',
            code: 'INVALID_PHONE'
        }, { status: 400 })
    }

    // ── Rate limiting ─────────────────────────────────────────────────────
    const rateCheck = checkPublicRateLimit(apiKey!.id, userId!, normalizedPhone, apiKey!.rate_limit_per_minute)
    if (!rateCheck.allowed) {
        logApiUsage(supabaseAdmin, {
            apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
            endpoint: '/api/public/v1/trigger', method: 'POST', statusCode: 429,
            requestBody: body, responseMs: Date.now() - startTime, ipAddress: ip
        })
        return NextResponse.json(
            { error: rateCheck.reason, code: 'RATE_LIMIT' },
            { status: 429, headers: rateCheck.headers }
        )
    }

    // ── Vérifier agent ────────────────────────────────────────────────────
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

    // ── Construire le contexte métier ─────────────────────────────────────
    const triggerContext: TriggerContext = {
        event,
        customer: { ...customer, phone: normalizedPhone },
        cart,
        order,
        appointment,
        data,
        message,
    }

    // ── Générer le message depuis le template ─────────────────────────────
    const generatedMessage = buildTriggerMessage(triggerContext)

    // ── Envoyer le message ────────────────────────────────────────────────
    const result = await sendMessageViaInternalBot({
        agentId: agent_id,
        to: normalizedPhone,
        message: generatedMessage,
    })

    if (!result.success) {
        logApiUsage(supabaseAdmin, {
            apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
            endpoint: '/api/public/v1/trigger', method: 'POST', statusCode: 500,
            requestBody: body, responseMs: Date.now() - startTime, ipAddress: ip
        })
        return NextResponse.json(
            { error: result.error || 'Failed to send message', code: 'SEND_FAILED' },
            { status: 500, headers: rateCheck.headers }
        )
    }

    // ── Sauvegarder en DB avec contexte métier ────────────────────────────
    let conversationId: string | null = null

    try {
        const { data: existingConv } = await supabaseAdmin
            .from('conversations')
            .select('id, metadata')
            .eq('agent_id', agent_id)
            .eq('customer_phone', normalizedPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        // Le contexte externe est stocké dans metadata.external_context
        // L'agent le lira lors de la prochaine réponse du client
        const convMetadata = {
            ...(existingConv?.metadata || {}),
            external_context: triggerContext,
        }

        if (existingConv) {
            conversationId = existingConv.id
            // Mettre à jour le contexte sur la conversation existante
            await supabaseAdmin
                .from('conversations')
                .update({ metadata: convMetadata, status: 'active' })
                .eq('id', existingConv.id)
        } else {
            const { data: newConv } = await supabaseAdmin
                .from('conversations')
                .insert({
                    agent_id,
                    user_id: userId,
                    customer_phone: normalizedPhone,
                    status: 'active',
                    metadata: convMetadata,
                })
                .select('id')
                .single()
            conversationId = newConv?.id || null
        }

        if (conversationId) {
            await supabaseAdmin.from('messages').insert({
                conversation_id: conversationId,
                agent_id,
                role: 'assistant',
                content: generatedMessage,
                whatsapp_message_id: result.messageId || null,
                status: 'sent',
                metadata: { source: 'trigger', event, ...(metadata || {}) }
            })
        }
    } catch (dbErr) {
        console.error('DB save error (non-blocking):', dbErr)
    }

    // ── Log usage ─────────────────────────────────────────────────────────
    const responseMs = Date.now() - startTime
    logApiUsage(supabaseAdmin, {
        apiKeyId: apiKey!.id, userId: userId!, agentId: agent_id,
        endpoint: '/api/public/v1/trigger', method: 'POST', statusCode: 200,
        requestBody: body, responseMs, ipAddress: ip
    })

    const responseBody = {
        success: true,
        data: {
            message_id: result.messageId || null,
            conversation_id: conversationId,
            event,
            message_sent: generatedMessage,
            status: 'sent',
            sent_at: new Date().toISOString(),
        }
    }

    // ── Stocker idempotence ───────────────────────────────────────────────
    if (idempotency_key) {
        storeIdempotency(supabaseAdmin, userId!, idempotency_key, responseBody)
    }

    return NextResponse.json(responseBody, { status: 200, headers: rateCheck.headers })
}
