import { queueOutboundWhatsAppMessage } from '@/lib/whatsapp/outbound'

type SupabaseAdminClient = {
    from: (table: string) => {
        select: (columns: string, options?: Record<string, unknown>) => any
        insert: (values: Record<string, unknown>) => any
        update: (values: Record<string, unknown>) => any
    }
}

type QueuePublicAssistantMessageParams = {
    supabase: SupabaseAdminClient
    agentId: string
    userId: string
    phone: string
    message: string
    conversationMetadata?: Record<string, unknown> | null
    messageMetadata?: Record<string, unknown> | null
}

function buildShadowMessageMetadata(
    messageMetadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
    return {
        ...(messageMetadata || {}),
        delivery_via: 'outbound_messages',
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeConversationMetadata(
    existingMetadata: unknown,
    nextMetadata: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
    const current = isObject(existingMetadata) ? existingMetadata : null
    if (!nextMetadata) return current
    return {
        ...(current || {}),
        ...nextMetadata,
    }
}

export async function queuePublicAssistantMessage(params: QueuePublicAssistantMessageParams): Promise<{
    conversationId: string | null
    queued: boolean
}> {
    const {
        supabase,
        agentId,
        userId,
        phone,
        message,
        conversationMetadata,
        messageMetadata,
    } = params

    const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id, metadata')
        .eq('agent_id', agentId)
        .eq('contact_phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const mergedMetadata = mergeConversationMetadata(existingConversation?.metadata, conversationMetadata)

    let conversationId: string | null = null

    if (existingConversation) {
        conversationId = existingConversation.id

        if (mergedMetadata) {
            await supabase
                .from('conversations')
                .update({ metadata: mergedMetadata, status: 'active' })
                .eq('id', existingConversation.id)
        } else {
            await supabase
                .from('conversations')
                .update({ status: 'active' })
                .eq('id', existingConversation.id)
        }
    } else {
        const { data: newConversation } = await supabase
            .from('conversations')
            .insert({
                agent_id: agentId,
                user_id: userId,
                contact_phone: phone,
                status: 'active',
                metadata: mergedMetadata,
            })
            .select('id')
            .single()

        conversationId = newConversation?.id || null
    }

    const queueResult = await queueOutboundWhatsAppMessage(supabase, {
        agentId,
        to: phone,
        message,
    })

    if (!queueResult.queued) {
        return {
            conversationId,
            queued: false,
        }
    }

    if (conversationId) {
        const shadowMessageMetadata = buildShadowMessageMetadata(messageMetadata)
        await supabase.from('messages').insert({
            conversation_id: conversationId,
            agent_id: agentId,
            role: 'assistant',
            content: message,
            whatsapp_message_id: null,
            // Public API sends are transported by outbound_messages, not by the assistant pending-message pipeline.
            status: 'sent',
            metadata: shadowMessageMetadata,
        })
    }

    return {
        conversationId,
        queued: true,
    }
}
