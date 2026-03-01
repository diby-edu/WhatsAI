import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

async function cleanupAgentDependencies(adminSupabase: ReturnType<typeof createAdminClient>, agentId: string) {
    // This table exists in production schema and can block agent deletion (FK restriction)
    const { error: outboundError } = await adminSupabase
        .from('outbound_messages')
        .delete()
        .eq('agent_id', agentId)

    if (outboundError && outboundError.code !== '42P01') {
        throw outboundError
    }

    // Current production schema uses session_id (key-value store)
    const { error: bySessionIdError } = await adminSupabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', agentId)

    if (!bySessionIdError) return

    // Legacy schema fallback uses agent_id
    if (bySessionIdError.code === '42703') {
        const { error: byAgentIdError } = await adminSupabase
            .from('whatsapp_sessions')
            .delete()
            .eq('agent_id', agentId)

        if (byAgentIdError && byAgentIdError.code !== '42P01' && byAgentIdError.code !== '42703') {
            throw byAgentIdError
        }
        return
    }

    if (bySessionIdError.code !== '42P01') {
        throw bySessionIdError
    }
}

// GET /api/agents/[id] - Get a single agent
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { data: agent, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', id)
        .eq('user_id', user!.id)
        .single()

    if (error) {
        if (process.env.NODE_ENV === 'development') {
            console.error('Agent fetch failed:', error.message)
        }
        return errorResponse('Agent non trouve', 404)
    }

    return successResponse({ agent })
}

// PATCH /api/agents/[id] - Update an agent
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()

        // Only allow specific fields to be updated
        const allowedFields = [
            'name', 'description', 'system_prompt', 'personality',
            'model', 'temperature', 'max_tokens', 'use_emojis',
            'response_delay_seconds', 'language', 'is_active',
            'enable_voice_responses', 'voice_id',
            // New structured fields
            'business_address', 'business_hours', 'contact_phone',
            'social_links', 'custom_rules', 'agent_tone', 'agent_goal',
            // GPS
            'latitude', 'longitude',
            // Payment settings
            'payment_mode', 'mobile_money_orange', 'mobile_money_mtn',
            'mobile_money_wave', 'custom_payment_methods', 'escalation_phone'
        ]

        const updates: Record<string, any> = {}
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field]
            }
        }

        const { data: agent, error } = await supabase
            .from('agents')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user!.id)
            .select()
            .single()

        if (error) {
            return errorResponse('Mise a jour echouee', 500)
        }

        return successResponse({ agent })
    } catch {
        return errorResponse('Donnees invalides', 400)
    }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const adminSupabase = createAdminClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    const { data: agent, error: fetchError } = await adminSupabase
        .from('agents')
        .select('id, user_id')
        .eq('id', id)
        .single()

    if (fetchError || !agent) {
        return errorResponse('Agent non trouve', 404)
    }

    if (agent.user_id !== user!.id) {
        return errorResponse('Acces refuse', 403)
    }

    try {
        await cleanupAgentDependencies(adminSupabase, id)
    } catch (cleanupError) {
        console.error('Agent dependency cleanup failed:', cleanupError)
        return errorResponse('Suppression echouee', 500)
    }

    const { error } = await adminSupabase
        .from('agents')
        .delete()
        .eq('id', id)

    if (error) {
        return errorResponse('Suppression echouee', 500)
    }

    return successResponse({ success: true })
}
