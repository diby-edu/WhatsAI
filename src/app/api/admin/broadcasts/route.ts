import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse, createAdminClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

// GET - Get broadcast history
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Forbidden - Admin only', 403)
    }

    try {
        const { data: broadcasts, error } = await adminSupabase
            .from('broadcasts')
            .select(`
                id,
                agent_id,
                message,
                recipients_count,
                created_at,
                status
            `)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            if (error.code === '42P01') {
                return successResponse({ broadcasts: [], message: 'Table not created' })
            }
            throw error
        }

        // Get agent names
        const broadcastsWithDetails = await Promise.all(
            (broadcasts || []).map(async (b: any) => {
                let agentName = null
                if (b.agent_id) {
                    const { data: agent } = await adminSupabase
                        .from('agents')
                        .select('name')
                        .eq('id', b.agent_id)
                        .single()
                    agentName = agent?.name
                }
                return { ...b, agent_name: agentName }
            })
        )

        return successResponse({ broadcasts: broadcastsWithDetails })
    } catch (err) {
        console.error('Admin broadcasts error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST - Send a new broadcast
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const adminSupabase = createAdminClient()
    const { data: profile } = await adminSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'admin') {
        return errorResponse('Forbidden - Admin only', 403)
    }

    try {
        const body = await request.json()
        const { agentId, message } = body

        if (!agentId || !message?.trim()) {
            return errorResponse('agentId and message are required', 400)
        }

        // Get all conversations for this agent
        const { data: conversations, error: convError } = await adminSupabase
            .from('conversations')
            .select('contact_phone')
            .eq('agent_id', agentId)

        if (convError) throw convError

        const uniquePhones = [...new Set(conversations?.map(c => c.contact_phone) || [])]

        if (uniquePhones.length === 0) {
            return errorResponse('No recipients found for this agent', 400)
        }

        // Queue messages for each recipient
        const outboundMessages = uniquePhones.map(phone => ({
            agent_id: agentId,
            recipient_phone: phone,
            message_content: message.trim(),
            status: 'pending',
            created_at: new Date().toISOString()
        }))

        const { error: insertError } = await adminSupabase
            .from('outbound_messages')
            .insert(outboundMessages)

        if (insertError && insertError.code !== '42P01') {
            throw insertError
        }

        // Log the broadcast
        try {
            await adminSupabase.from('broadcasts').insert({
                agent_id: agentId,
                message: message.trim(),
                recipients_count: uniquePhones.length,
                status: 'sent',
                created_at: new Date().toISOString()
            })
        } catch (broadcastLogError) {
            console.warn('Could not log broadcast:', broadcastLogError)
        }

        return successResponse({
            success: true,
            recipientCount: uniquePhones.length,
            message: `Broadcast queued for ${uniquePhones.length} recipients`
        })
    } catch (err) {
        console.error('Error sending broadcast:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
