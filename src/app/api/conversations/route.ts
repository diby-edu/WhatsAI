import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/conversations - List all conversations for current user
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
        .from('conversations')
        .select(`
      *,
      agent:agents(id, name, avatar_url)
    `)
        .eq('user_id', user!.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1)

    if (agentId) {
        query = query.eq('agent_id', agentId)
    }

    if (status) {
        query = query.eq('status', status)
    }

    const { data: conversations, error, count } = await query

    if (error) {
        return errorResponse(error.message, 500)
    }

    return successResponse({ conversations, count })
}
