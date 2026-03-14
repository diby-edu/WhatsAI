import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { response, adminSupabase } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const page = Math.max(1, Number(searchParams.get('page') || '1'))
        const limit = Math.min(100, Math.max(20, Number(searchParams.get('limit') || '50')))
        const from = (page - 1) * limit
        const to = from + limit - 1

        const { data: conversation, error: conversationError } = await adminSupabase
            .from('conversations')
            .select(`
                id,
                contact_phone,
                contact_name,
                contact_push_name,
                status,
                lead_status,
                lead_score,
                last_message_text,
                last_message_at,
                created_at,
                updated_at,
                agent:agents(id, name),
                owner:profiles!conversations_user_id_fkey(id, full_name, email)
            `)
            .eq('id', id)
            .single()

        if (conversationError || !conversation) {
            return errorResponse('Conversation introuvable', 404)
        }

        const { data: messages, error: messagesError, count } = await adminSupabase
            .from('messages')
            .select('id, role, content, message_type, media_url, created_at, status', { count: 'exact' })
            .eq('conversation_id', id)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (messagesError) throw messagesError

        return successResponse({
            conversation,
            messages: (messages || []).reverse(),
            pagination: {
                page,
                limit,
                total: count || 0,
                hasMore: (count || 0) > to + 1,
            },
        })
    } catch (err: any) {
        console.error('Admin conversation detail error:', err)
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
