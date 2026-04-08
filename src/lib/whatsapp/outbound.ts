type QueueOutboundWhatsAppMessageParams = {
    agentId: string
    to: string
    message: string
    mediaUrl?: string
    mediaType?: 'document' | 'image'
}

type SupabaseLikeClient = {
    from: (table: string) => {
        insert: (values: Record<string, unknown>) => any
    }
}

function normalizeRecipientPhone(to: string): string {
    return to.replace('@s.whatsapp.net', '').trim()
}

export async function queueOutboundWhatsAppMessage(
    supabase: SupabaseLikeClient,
    { agentId, to, message, mediaUrl, mediaType, mediaFileName }: QueueOutboundWhatsAppMessageParams
): Promise<{ queued: boolean; reason?: 'table_missing' }> {
    const { error } = await supabase.from('outbound_messages').insert({
        agent_id: agentId,
        recipient_phone: normalizeRecipientPhone(to),
        message_content: message,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        status: 'pending',
        created_at: new Date().toISOString(),
    })

    if (error) {
        if (error.code === '42P01') {
            console.warn('outbound_messages table not found, skipping WhatsApp queue')
            return { queued: false, reason: 'table_missing' }
        }

        throw error
    }

    return { queued: true }
}
