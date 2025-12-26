import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/conversations/[id] - Get conversation with messages
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

    // Get conversation
    const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select(`
      *,
      agent:agents(id, name, avatar_url, system_prompt)
    `)
        .eq('id', id)
        .eq('user_id', user!.id)
        .single()

    if (convError) {
        return errorResponse('Conversation non trouvée', 404)
    }

    // Get messages
    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })

    if (msgError) {
        return errorResponse(msgError.message, 500)
    }

    // Mark as read
    await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', id)

    return successResponse({ conversation, messages })
}

// PATCH /api/conversations/[id] - Update conversation status
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

        const allowedFields = ['status', 'is_starred', 'lead_status', 'lead_score', 'contact_name']

        const updates: Record<string, any> = {}
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field]
            }
        }

        const { data: conversation, error } = await supabase
            .from('conversations')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user!.id)
            .select()
            .single()

        if (error) {
            return errorResponse('Mise à jour échouée', 500)
        }

        return successResponse({ conversation })
    } catch (err) {
        return errorResponse('Données invalides', 400)
    }
}
