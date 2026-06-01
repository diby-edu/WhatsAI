import { randomBytes } from 'node:crypto'
import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { getAIRuntimeSettings } from '@/lib/admin/settings'
import { buildAccountLifecycleAccessState, getAccountLifecycleBlockMessage } from '@/lib/account-lifecycle'
import { resolveAgentEcommerceMode } from '@/lib/agents/ecommerce-mode'

export const dynamic = 'force-dynamic'

// Champs autorisés à l'import (même liste que l'export, sans les champs système)
const ALLOWED_IMPORT_FIELDS = new Set([
    'name', 'description', 'system_prompt', 'personality', 'model',
    'temperature', 'max_tokens', 'use_emojis', 'response_delay_seconds',
    'language', 'enable_voice_responses', 'voice_id',
    'business_address', 'business_hours', 'contact_phone', 'social_links',
    'custom_rules', 'agent_tone', 'agent_goal',
    'latitude', 'longitude', 'is_online_only',
    'agent_context', 'welcome_message',
    'lead_collection_enabled', 'lead_redirect_message', 'lead_collect_fields',
    'fallback_contact_message', 'mission', 'payment_mode',
    'mobile_money_orange', 'mobile_money_mtn', 'mobile_money_wave',
    'custom_payment_methods', 'escalation_phone',
    'live_query_url', 'live_query_secret', 'external_sync_reply_message',
    'restaurant_deposit_enabled', 'restaurant_deposit_mode',
    'restaurant_deposit_percentage', 'restaurant_deposit_fixed_amount_fcfa',
    // ecommerce_mode est géré séparément via resolveAgentEcommerceMode
])

const SUPPORTED_PROVIDERS = new Set(['shopify', 'woocommerce', 'chariow', 'maketou', 'generic'])

export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) return errorResponse('Non autorisé', 401)

    let body: any
    try {
        body = await request.json()
    } catch {
        return errorResponse('JSON invalide', 400)
    }

    // Valider le format du fichier exporté
    if (body?.wazzapai_export !== '1.0' || !body?.agent || typeof body.agent !== 'object') {
        return errorResponse('Format de fichier invalide. Utilisez un fichier exporté depuis WazzapAI.', 400)
    }

    const imported = body.agent

    if (!imported.name || typeof imported.name !== 'string') {
        return errorResponse('Le champ "name" est requis dans la configuration importée.', 400)
    }

    // Connexions webhook optionnelles
    const importedConnections: any[] = Array.isArray(body.platform_connections)
        ? body.platform_connections.filter((c: any) =>
            c && typeof c.provider === 'string' && SUPPORTED_PROVIDERS.has(c.provider)
          )
        : []

    // Vérifier le quota d'agents du plan
    let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan, paid_until, grace_until, test_account_cleanup_deadline, test_account_qualified_at')
        .eq('id', user.id)
        .single()

    if (profileError?.code === '42703') {
        const fallback = await supabase.from('profiles').select('plan').eq('id', user.id).single()
        profile = fallback.data as any
        profileError = fallback.error
    }

    if (profileError) return errorResponse('Impossible de vérifier le statut du compte', 500)

    const lifecycleAccess = buildAccountLifecycleAccessState({
        paidUntil: (profile as any)?.paid_until || null,
        graceUntil: (profile as any)?.grace_until || null,
        testAccountCleanupDeadline: (profile as any)?.test_account_cleanup_deadline || null,
        testAccountQualifiedAt: (profile as any)?.test_account_qualified_at || null,
    })

    const blockMessage = getAccountLifecycleBlockMessage(lifecycleAccess, 'agent_creation')
    if (blockMessage) return errorResponse(blockMessage, 403)

    const { PLANS } = await import('@/lib/plans')
    const planKey = ((profile?.plan || 'free') as string).toLowerCase()
    const limit: number = (PLANS as any)[planKey]?.agents ?? 1

    const { count: agentCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('archived_at', null)

    if (limit !== -1 && (agentCount || 0) >= limit) {
        return errorResponse(`Limite d'agents atteinte pour votre plan (${limit} max)`, 403)
    }

    const adminClient = createAdminClient()
    const aiDefaults = await getAIRuntimeSettings(adminClient)

    // Filtrer uniquement les champs autorisés (ecommerce_mode exclu — normalisé ci-dessous)
    const safeFields = Object.fromEntries(
        Object.entries(imported).filter(([key]) => ALLOWED_IMPORT_FIELDS.has(key))
    )

    // Normaliser ecommerce_mode exactement comme la route de création d'agent
    const ecommerceMode = resolveAgentEcommerceMode(imported.mission, imported.ecommerce_mode)

    const { data: agent, error } = await supabase
        .from('agents')
        .insert({
            user_id: user.id,
            ...safeFields,
            name: `${imported.name} (copie)`,
            ecommerce_mode: ecommerceMode,
            model: imported.model || aiDefaults.openaiModel,
            temperature: imported.temperature ?? aiDefaults.temperatureDefault,
            max_tokens: imported.max_tokens ?? aiDefaults.maxTokensPerMessage,
            personality: imported.personality || 'friendly',
            language: imported.language || 'fr',
            is_active: true,
            whatsapp_connected: false,
            whatsapp_ever_connected: false,
        })
        .select('id, name')
        .single()

    if (error) return errorResponse("Erreur lors de la création de l'agent", 500)

    // Recréer les connexions webhook avec de nouveaux tokens/secrets
    let connectionsCreated = 0
    for (const conn of importedConnections) {
        const token = randomBytes(32).toString('hex')
        const secret = randomBytes(32).toString('hex')
        const { error: connError } = await adminClient
            .from('api_platform_connections')
            .insert({
                user_id: user.id,
                agent_id: agent!.id,
                provider: conn.provider,
                name: conn.name || conn.provider,
                allowed_events: conn.allowed_events ?? null,
                rate_limit_per_minute: conn.rate_limit_per_minute ?? 60,
                metadata: conn.metadata ?? null,
                webhook_token: token,
                signing_secret: secret,
                is_active: true,
            })
        if (!connError) connectionsCreated++
    }

    return successResponse({
        agent,
        connections_restored: connectionsCreated,
        connections_note: connectionsCreated > 0
            ? `${connectionsCreated} connexion(s) webhook recréée(s) avec de nouvelles URLs. Mettez à jour vos plateformes (Chariow Pulse, etc.) avec les nouvelles URLs webhook depuis le Mode Développeur.`
            : null,
    }, 201)
}
