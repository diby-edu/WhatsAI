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
            return errorResponse(error.message, 500)
        }

        // Optimized: Get message counts and last messages in batch queries
        const conversationIds = (conversations || []).map((c: any) => c.id)

        if (conversationIds.length === 0) {
            return successResponse({ conversations: [] })
        }

        // Batch query for message counts - single query for all conversations
        const { data: messageCounts } = await supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', conversationIds)

        // Count messages per conversation
        const countMap: Record<string, number> = {}
        ;(messageCounts || []).forEach((m: any) => {
            countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1
        })

        // Batch query for last messages - get recent messages for all conversations
        const { data: recentMessages } = await supabase
            .from('messages')
            .select('conversation_id, content, created_at')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: false })

        // Get last message per conversation
        const lastMessageMap: Record<string, { content: string; created_at: string }> = {}
        ;(recentMessages || []).forEach((m: any) => {
            if (!lastMessageMap[m.conversation_id]) {
                lastMessageMap[m.conversation_id] = { content: m.content, created_at: m.created_at }
            }
        })

        // Combine data
        const conversationsWithDetails = (conversations || []).map((conv: any) => ({
            ...conv,
            messages_count: countMap[conv.id] || 0,
            last_message: lastMessageMap[conv.id]?.content || '',
            last_message_at: lastMessageMap[conv.id]?.created_at || conv.updated_at
        }))

        return successResponse({ conversations: conversationsWithDetails })
    } catch (err) {
        console.error('Error in conversations API:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
