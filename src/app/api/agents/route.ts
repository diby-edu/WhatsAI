import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { notifyAdmins } from '@/lib/notifications/admin-notify'
import { getAIRuntimeSettings } from '@/lib/admin/settings'
import { normalizeAgentPaymentMode } from '@/lib/payments/payment-mode-display'
import { buildAccountLifecycleAccessState, getAccountLifecycleBlockMessage } from '@/lib/account-lifecycle'
import { resolveAgentEcommerceMode } from '@/lib/agents/ecommerce-mode'

const CreateAgentSchema = z.object({
    name: z.string().min(1, "Le nom de l'agent est requis").max(150),
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().int().min(1).max(32768).optional(),
    response_delay_seconds: z.number().min(0).max(300).optional(),
})

function normalizeRestaurantDepositSettings(body: any) {
    const enabled = !!body.restaurant_deposit_enabled
    const rawMode = String(body.restaurant_deposit_mode ?? 'percentage').trim().toLowerCase()
    const depositMode = rawMode === 'fixed' ? 'fixed' : 'percentage'
    const rawPercentage = Number(body.restaurant_deposit_percentage ?? 0)
    const boundedPercentage = Number.isFinite(rawPercentage)
        ? Math.max(0, Math.min(100, rawPercentage))
        : 0
    const rawFixedAmount = Number(body.restaurant_deposit_fixed_amount_fcfa ?? 0)
    const boundedFixedAmount = Number.isFinite(rawFixedAmount)
        ? Math.max(0, Math.round(rawFixedAmount))
        : 0

    return {
        restaurant_deposit_enabled: enabled,
        restaurant_deposit_mode: enabled ? depositMode : 'percentage',
        restaurant_deposit_percentage: enabled && depositMode === 'percentage' ? boundedPercentage : 0,
        restaurant_deposit_fixed_amount_fcfa: enabled && depositMode === 'fixed' ? boundedFixedAmount : 0
    }
}

// GET /api/agents - List all agents for current user
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { data: agents, error } = await supabase
        .from('agents')
        .select('*, conversations(count), products(product_type), knowledge_base(count), leads(count)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

    if (error) {
        return errorResponse(error.message, 500)
    }

    // Map the result to flatten conversations count and product types
    const agentsWithCount = agents.map((agent: any) => ({
        ...agent,
        total_conversations: agent.conversations?.[0]?.count || 0,
        product_types: [...new Set((agent.products || []).map((p: any) => p.product_type).filter(Boolean))],
        knowledge_count: agent.knowledge_base?.[0]?.count || 0,
        lead_count: agent.leads?.[0]?.count || 0,
        product_count: (agent.products || []).length,
    }))

    return successResponse({ agents: agentsWithCount })
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()

        const parsed = CreateAgentSchema.safeParse(body)
        if (!parsed.success) {
            return errorResponse('Données invalides : ' + parsed.error.issues.map(e => e.message).join(', '), 400)
        }

        const adminSupabase = createAdminClient()
        const aiDefaults = await getAIRuntimeSettings(adminSupabase)
        const restaurantDepositSettings = normalizeRestaurantDepositSettings(body)
        const paymentMode = normalizeAgentPaymentMode(body.payment_mode)
        const ecommerceMode = resolveAgentEcommerceMode(body.mission, body.ecommerce_mode)

        // Check agent limit based on plan (reads from DB so admin changes take effect)
        let { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('plan, email, paid_until, grace_until, test_account_cleanup_deadline, test_account_qualified_at')
            .eq('id', user!.id)
            .single()

        if (profileError?.code === '42703') {
            const fallback = await supabase
                .from('profiles')
                .select('plan, email')
                .eq('id', user!.id)
                .single()

            profile = fallback.data as any
            profileError = fallback.error
        }

        if (profileError) {
            return errorResponse('Impossible de verifier le statut du compte', 500)
        }

        const lifecycleAccess = buildAccountLifecycleAccessState({
            paidUntil: (profile as any)?.paid_until || null,
            graceUntil: (profile as any)?.grace_until || null,
            testAccountCleanupDeadline: (profile as any)?.test_account_cleanup_deadline || null,
            testAccountQualifiedAt: (profile as any)?.test_account_qualified_at || null,
        })

        const blockMessage = getAccountLifecycleBlockMessage(lifecycleAccess, 'agent_creation')
        if (blockMessage) {
            return errorResponse(blockMessage, 403)
        }

        const { count: agentCount } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user!.id)
            .is('archived_at', null)

        const { data: planData } = await supabase
            .from('subscription_plans')
            .select('max_agents')
            .ilike('name', profile?.plan || 'free')
            .single()

        const { PLANS } = await import('@/lib/plans')
        const planKey = ((profile?.plan || 'free') as string).toLowerCase()
        const fallbackLimit: number = (PLANS as any)[planKey]?.agents ?? 1
        const limit: number = planData?.max_agents ?? fallbackLimit

        if (limit !== -1 && (agentCount || 0) >= limit) {
            notifyAdmins('agent_quota_exceeded', {
                userId: user!.id,
                userEmail: profile?.email,
                planName: profile?.plan || 'free',
            }).catch(() => {})
            return errorResponse(`Limite d'agents atteinte pour votre plan (${limit} max)`, 403)
        }

        // Create agent
        const { data: agent, error } = await supabase
            .from('agents')
            .insert({
                user_id: user!.id,
                name: body.name,
                description: body.description || null,
                system_prompt: body.system_prompt || '',
                personality: body.personality || 'friendly',
                model: body.model || aiDefaults.openaiModel,
                temperature: body.temperature ?? aiDefaults.temperatureDefault,
                max_tokens: body.max_tokens ?? aiDefaults.maxTokensPerMessage,
                use_emojis: body.use_emojis ?? true,
                response_delay_seconds: body.response_delay_seconds || 2,
                language: body.language || 'fr',
                is_active: true,
                whatsapp_connected: false,
                whatsapp_ever_connected: false,
                enable_voice_responses: body.enable_voice_responses ?? false,
                voice_id: body.voice_id || 'alloy',
                // New structured fields
                business_address: body.business_address || null,
                business_hours: body.business_hours || "Lundi-Vendredi: 08:00 - 18:00\nSamedi: 09:00 - 13:00",
                contact_phone: body.contact_phone || null,
                social_links: {
                    website: body.site_url || null,
                    ...(body.social_links || {})
                },
                custom_rules: body.custom_rules || null,
                agent_tone: body.agent_tone || 'friendly',
                agent_goal: body.agent_goal || 'sales',
                // GPS (Optional)
                latitude: body.latitude || null,
                longitude: body.longitude || null,
                is_online_only: body.is_online_only ?? false,
                // Agent context (Support Client)
                agent_context: body.agent_context || null,
                welcome_message: body.welcome_message || null,
                lead_collection_enabled: body.lead_collection_enabled ?? false,
                lead_redirect_message: body.lead_redirect_message || null,
                lead_collect_fields: body.lead_collect_fields || ['name', 'phone'],
                fallback_contact_message: body.fallback_contact_message || null,
                mission: body.mission || null,
                ecommerce_mode: ecommerceMode,
                // Payment & escalation (Support Client + transactionnel)
                payment_mode: paymentMode,
                mobile_money_orange: body.mobile_money_orange || null,
                mobile_money_mtn: body.mobile_money_mtn || null,
                mobile_money_wave: body.mobile_money_wave || null,
                custom_payment_methods: body.custom_payment_methods || null,
                escalation_phone: body.escalation_phone || null,
                live_query_url: body.live_query_url || null,
                live_query_secret: body.live_query_secret || null,
                external_sync_reply_message: body.external_sync_reply_message || null,
                ...restaurantDepositSettings
            })
            .select()
            .single()

        if (error) {
            return errorResponse(error.message, 500)
        }

        // Notify admins of new agent creation
        notifyAdmins('agent_created', {
            userId: user!.id,
            userEmail: profile?.email,
            agentName: agent.name,
            agentId: agent.id,
        }).catch(() => {})

        return successResponse({ agent }, 201)
    } catch (err) {
        return errorResponse('Données invalides', 400)
    }
}
