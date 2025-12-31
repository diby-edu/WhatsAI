import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        // Get user's conversations with agent info and message counts


        // Apply filters
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const bot_paused = url.searchParams.get('bot_paused')

        const query = supabase
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
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })

        if (status) query.eq('status', status)
        if (bot_paused === 'true') query.eq('bot_paused', true)
        if (bot_paused === 'false') query.eq('bot_paused', false)

        const { data: conversations, error } = await query

        if (error) {
            console.error('Error fetching conversations:', error)
            return errorResponse(error.message, 500)
        }

        // Get message counts and last message for each conversation
        const conversationsWithDetails = await Promise.all((conversations || []).map(async (conv: any) => {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conv.id)

            const { data: lastMsg } = await supabase
                .from('messages')
                .select('content, created_at')
                .eq('conversation_id', conv.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            return {
                ...conv,
                messages_count: count || 0,
                last_message: lastMsg?.content || '',
                last_message_at: lastMsg?.created_at || conv.updated_at
            }
        }))

        return successResponse({ conversations: conversationsWithDetails })
    } catch (err) {
        console.error('Error in conversations API:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
