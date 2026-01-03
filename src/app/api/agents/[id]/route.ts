import { NextRequest, NextResponse } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

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
        // Log error without exposing sensitive user data
        if (process.env.NODE_ENV === 'development') {
            console.error('Agent fetch failed:', error.message)
        }
        return errorResponse('Agent non trouvé', 404)
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
            'latitude', 'longitude'
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
            return errorResponse('Mise à jour échouée', 500)
        }

        return successResponse({ agent })
    } catch (err) {
        return errorResponse('Données invalides', 400)
    }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    // First disconnect WhatsApp if connected
    await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('agent_id', id)

    const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', id)
        .eq('user_id', user!.id)

    if (error) {
        return errorResponse('Suppression échouée', 500)
    }

    return successResponse({ success: true })
}
