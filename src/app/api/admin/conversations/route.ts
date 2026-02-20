import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Non autorisé', 401)
    }

    // Verify admin role via DB (secure)
    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Accès refusé', 403)
    }

    try {
        const { data: conversations, error } = await adminSupabase
            .from('conversations')
            .select(`
                id,
                contact_phone,
                contact_push_name,
                created_at,
                updated_at,
                agent:agents(name),
                profile:profiles(full_name, email)
            `)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('Error fetching conversations:', error)
            return errorResponse(error.message, 500)
        }

        // Add message counts for each conversation
        const conversationsWithCounts = await Promise.all(conversations.map(async (conv) => {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conv.id)

            // Get last message
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

        return successResponse({ conversations: conversationsWithCounts })
    } catch (err) {
        return errorResponse('Erreur serveur', 500)
    }
}
