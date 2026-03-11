import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { notifyAdmins } from '@/lib/notifications/admin-notify'

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

        const { data: planData } = await supabase
            .from('subscription_plans')
            .select('max_agents')
            .ilike('name', profile?.plan || 'free')
            .single()

        // Fallback to plans.ts if DB unavailable; -1 = unlimited
        const { PLANS } = await import('@/lib/plans')
        const fallbackLimit = (PLANS as any)[profile?.plan || 'free']?.agents ?? 1
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
                system_prompt: body.system_prompt,
                personality: body.personality || 'friendly',
                model: body.model || 'gpt-4o-mini',
                temperature: body.temperature || 0.7,
                max_tokens: body.max_tokens || 500,
                use_emojis: body.use_emojis ?? true,
                response_delay_seconds: body.response_delay_seconds || 2,
                language: body.language || 'fr',
                is_active: true,
                whatsapp_connected: false,
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
                is_online_only: body.is_online_only ?? false
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
