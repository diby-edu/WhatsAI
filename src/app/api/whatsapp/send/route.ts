import { NextRequest } from 'next/server'
import { createAdminClient, createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'

// POST /api/whatsapp/send - Queue a WhatsApp message for sending by the bot
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()
        const { agentId, to, message } = body

        if (!agentId || !to || !message) {
            return errorResponse('agentId, to, and message are required', 400)
        }

        const { data: agent, error } = await supabase
            .from('agents')
            .select('id')
            .eq('id', agentId)
            .eq('user_id', user!.id)
            .single()

        if (error || !agent) {
            return errorResponse('Agent non trouve', 404)
        }

        const adminSupabase = createAdminClient()
        await queueOutboundWhatsAppMessage(adminSupabase, {
            agentId,
            to,
            message,
        })

        const phoneNumber = to.replace('@s.whatsapp.net', '')

        let { data: conversation } = await supabase
            .from('conversations')
            .select('id')
            .eq('agent_id', agentId)
            .eq('contact_phone', phoneNumber)
            .single()

        if (!conversation) {
            const { data: newConversation } = await supabase
                .from('conversations')
                .insert({
                    agent_id: agentId,
                    user_id: user!.id,
                    contact_phone: phoneNumber,
                    status: 'active',
                })
                .select('id')
                .single()

            conversation = newConversation
        }

        if (conversation) {
            await supabase
                .from('messages')
                .insert({
                    conversation_id: conversation.id,
                    agent_id: agentId,
                    role: 'assistant',
                    content: message,
                    whatsapp_message_id: null,
                    status: 'sent',
                    metadata: {
                        source: 'internal_send_api',
                        delivery_via: 'outbound_messages',
                    },
                })
        }

        return successResponse({
            success: true,
            queued: true,
        })
    } catch (err) {
        console.error('Queue WhatsApp message error:', err)
        return errorResponse('Erreur d envoi', 500)
    }
}
