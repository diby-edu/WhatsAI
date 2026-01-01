import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

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

        // Check agent limit based on plan
        const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', user!.id)
            .single()

        const { count: agentCount } = await supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user!.id)

        const planLimits: Record<string, number> = {
            free: 1,
            starter: 1,
            pro: 2,
            business: 4
        }

        const limit = planLimits[profile?.plan || 'free'] || 1
        if ((agentCount || 0) >= limit) {
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
            })
            .select()
            .single()

        if (error) {
            return errorResponse(error.message, 500)
        }

        return successResponse({ agent }, 201)
    } catch (err) {
        return errorResponse('Données invalides', 400)
    }
}
