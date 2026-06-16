import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const EXPORT_FIELDS = [
    'name', 'description', 'system_prompt', 'personality', 'model',
    'temperature', 'max_tokens', 'use_emojis', 'response_delay_seconds',
    'language', 'enable_voice_responses', 'voice_id',
    'business_address', 'business_hours', 'contact_phone', 'social_links',
    'custom_rules', 'agent_tone', 'agent_goal',
    'latitude', 'longitude', 'is_online_only',
    'agent_context', 'welcome_message',
    'lead_collection_enabled', 'lead_redirect_message', 'lead_collect_fields',
    'fallback_contact_message', 'mission', 'ecommerce_mode', 'payment_mode',
    'mobile_money_orange', 'mobile_money_mtn', 'mobile_money_wave',
    'custom_payment_methods', 'escalation_phone',
    'live_query_url', 'live_query_secret', 'external_sync_reply_message',
    'restaurant_deposit_enabled', 'restaurant_deposit_mode',
    'restaurant_deposit_percentage', 'restaurant_deposit_fixed_amount_fcfa',
]

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) return errorResponse('Non autorisé', 401)

    const adminClient = createAdminClient()

    const { data: agent, error } = await adminClient
        .from('agents')
        .select(EXPORT_FIELDS.join(', '))
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (error || !agent) return errorResponse('Agent non trouvé', 404)

    // Exporter aussi les connexions API (sans webhook_token ni signing_secret — régénérés à l'import)
    const { data: connections } = await adminClient
        .from('api_platform_connections')
        .select('provider, name, allowed_events, rate_limit_per_minute, metadata')
        .eq('agent_id', id)
        .eq('user_id', user.id)

    // Exporter la base de connaissances (titre, contenu, type)
    const { data: kbDocs } = await adminClient
        .from('knowledge_base')
        .select('title, content, content_type')
        .eq('agent_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    const exportData = {
        wazzapai_export: '1.0',
        exported_at: new Date().toISOString(),
        agent: Object.fromEntries(
            EXPORT_FIELDS.map(f => [f, (agent as any)[f] ?? null])
        ),
        // Base de connaissances complète
        knowledge_base: (kbDocs || []).map(doc => ({
            title: doc.title,
            content: doc.content,
            content_type: doc.content_type || 'text',
        })),
        // Connexions webhook : provider/config préservés, URLs et secrets régénérés à l'import
        platform_connections: (connections || []).map(c => ({
            provider: c.provider,
            name: c.name,
            allowed_events: c.allowed_events ?? null,
            rate_limit_per_minute: c.rate_limit_per_minute ?? null,
            metadata: c.metadata ?? null,
        })),
    }

    const filename = `agent-${(agent as any).name?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || id}-config.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}
