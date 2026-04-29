import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Événements officiels — synchronisés avec ALLOWED_EVENTS dans /api/developer/webhooks/route.ts
export type WebhookEvent =
    | 'message.received'
    | 'message.sent'
    | 'conversation.started'
    | 'conversation.ended'
    | 'lead.collected'
    | 'order.created'
    | 'payment.received'
    | 'booking.created'

export interface WebhookPayload {
    event: WebhookEvent
    timestamp: string
    data: Record<string, unknown>
}

interface ApiWebhook {
    id: string
    user_id: string
    agent_id: string | null
    url: string
    secret: string | null
    events: WebhookEvent[]
    is_active: boolean
}

function signPayload(payload: string, secret: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function triggerWebhooks(
    userId: string,
    event: WebhookEvent,
    data: Record<string, unknown>
): Promise<void> {
    const supabase = getAdminClient()

    const { data: webhooks, error } = await supabase
        .from('api_webhooks')
        .select('id, user_id, agent_id, url, secret, events, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)

    if (error || !webhooks?.length) return

    const matching = (webhooks as ApiWebhook[]).filter(w => w.events.includes(event))
    if (!matching.length) return

    const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
    }
    const body = JSON.stringify(payload)

    await Promise.allSettled(
        matching.map(async (webhook) => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'X-Wazzap-Event': event,
                'X-Wazzap-Delivery': crypto.randomUUID(),
            }
            if (webhook.secret) {
                headers['X-Wazzap-Signature'] = signPayload(body, webhook.secret)
            }

            let status = 0
            let response_body = ''
            let success = false

            try {
                const res = await fetch(webhook.url, {
                    method: 'POST',
                    headers,
                    body,
                    signal: AbortSignal.timeout(10_000),
                })
                status = res.status
                response_body = await res.text().catch(() => '')
                success = res.ok
            } catch (err) {
                response_body = err instanceof Error ? err.message : 'Network error'
            }

            await supabase.from('webhook_deliveries').insert({
                webhook_id: webhook.id,
                event,
                payload,
                status_code: status || null,
                response_body: response_body.slice(0, 500),
                success,
            })
        })
    )
}
