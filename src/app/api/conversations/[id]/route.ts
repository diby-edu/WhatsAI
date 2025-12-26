import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: conversationId } = await params
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        // Get conversation details
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select(`
                id,
                contact_phone,
                contact_push_name,
                status,
                bot_paused,
                created_at,
                updated_at,
                agent:agents(id, name)
            `)
            .eq('id', conversationId)
            .eq('user_id', user.id)
            .single()

        if (convError || !conversation) {
            return errorResponse('Conversation not found', 404)
        }

        // Get all messages for this conversation
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('id, role, content, created_at, message_type, status')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })

        if (msgError) {
            console.error('Error fetching messages:', msgError)
            return errorResponse(msgError.message, 500)
        }

        return successResponse({
            conversation,
            messages: messages || []
        })
    } catch (err) {
        console.error('Error in conversation detail API:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
