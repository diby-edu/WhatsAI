import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { sendWhatsAppMessage, sendMessageWithTyping, getSessionStatus } from '@/lib/whatsapp/baileys'

// POST /api/whatsapp/send - Send a WhatsApp message
export async function POST(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    try {
        const body = await request.json()
        const { agentId, to, message, simulateTyping } = body

        if (!agentId || !to || !message) {
            return errorResponse('agentId, to, and message are required', 400)
        }

        // Verify agent belongs to user
        const { data: agent, error } = await supabase
            .from('agents')
            .select('id, response_delay_seconds')
            .eq('id', agentId)
            .eq('user_id', user!.id)
            .single()

        if (error || !agent) {
            return errorResponse('Agent non trouvé', 404)
        }

        // Check if connected
        const session = getSessionStatus(agentId)
        if (!session || session.status !== 'connected') {
            return errorResponse('WhatsApp non connecté', 400)
        }

        // Send message
        let result
        if (simulateTyping) {
            const typingDuration = (agent.response_delay_seconds || 2) * 1000
            result = await sendMessageWithTyping(agentId, to, message, typingDuration)
        } else {
            result = await sendWhatsAppMessage(agentId, to, message)
        }

        if (!result.success) {
            return errorResponse(result.error || 'Échec de l\'envoi', 500)
        }

        // Log message in database
        // First, find or create conversation
        const phoneNumber = to.replace('@s.whatsapp.net', '')

        let { data: conversation } = await supabase
            .from('conversations')
            .select('id')
            .eq('agent_id', agentId)
            .eq('contact_phone', phoneNumber)
            .single()

        if (!conversation) {
            const { data: newConv } = await supabase
                .from('conversations')
                .insert({
                    agent_id: agentId,
                    user_id: user!.id,
                    contact_phone: phoneNumber,
                    status: 'active',
                })
                .select('id')
                .single()
            conversation = newConv
        }

        if (conversation) {
            // Insert message
            await supabase
                .from('messages')
                .insert({
                    conversation_id: conversation.id,
                    agent_id: agentId,
                    role: 'assistant',
                    content: message,
                    whatsapp_message_id: result.messageId,
                    status: 'sent',
                })
        }

        return successResponse({
            success: true,
            messageId: result.messageId,
        })
    } catch (err) {
        console.error('Send message error:', err)
        return errorResponse('Erreur d\'envoi', 500)
    }
}
