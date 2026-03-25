import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { notifyAdmins } from '@/lib/notifications/admin-notify'
import { getAIRuntimeSettings } from '@/lib/admin/settings'

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
        .select('*, conversations(count)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })

    if (error) {
        return errorResponse(error.message, 500)
    }

    // Map the result to flatten conversations count
    const agentsWithCount = agents.map((agent: any) => ({
        ...agent,
        total_conversations: agent.conversations?.[0]?.count || 0
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
        const adminSupabase = createAdminClient()
        const aiDefaults = await getAIRuntimeSettings(adminSupabase)

        // Validate required fields
        if (!body.name || !body.system_prompt) {
            return errorResponse('Le nom et les instructions sont requis', 400)
        }

        // Check agent limit based on plan (reads from DB so admin changes take effect)
        const { data: profile } = await supabase
            .from('profiles')
            .select('plan, email')
            .eq('id', user!.id)
            .single()

        const { count: agentCount } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user!.id)
            .is('archived_at', null)

        // Use plans.ts as single source of truth for agent limits
        const { PLANS } = await import('@/lib/plans')
        const planKey = ((profile?.plan || 'free') as string).toLowerCase()
        const limit: number = (PLANS as any)[planKey]?.agents ?? 1

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
                system_prompt: body.system_prompt,
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
                // Payment & escalation (Support Client + transactionnel)
                payment_mode: body.payment_mode || null,
                mobile_money_orange: body.mobile_money_orange || null,
                mobile_money_mtn: body.mobile_money_mtn || null,
                mobile_money_wave: body.mobile_money_wave || null,
                custom_payment_methods: body.custom_payment_methods || null,
                escalation_phone: body.escalation_phone || null
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
