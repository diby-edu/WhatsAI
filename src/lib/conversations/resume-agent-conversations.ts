type SupabaseClientLike = any

export async function resumeActiveConversationsForAgents(
    adminSupabase: SupabaseClientLike,
    agentIds: Array<string | null | undefined>
) {
    const ids = Array.from(new Set(
        (agentIds || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    ))

    if (ids.length === 0) {
        return { resumedCount: 0 }
    }

    const { data: pausedConversations, error: selectError } = await adminSupabase
        .from('conversations')
        .select('id')
        .in('agent_id', ids)
        .eq('status', 'active')
        .eq('bot_paused', true)

    if (selectError) {
        throw selectError
    }

    const conversationIds = (pausedConversations || [])
        .map((conversation: any) => conversation.id)
        .filter(Boolean)

    if (conversationIds.length === 0) {
        return { resumedCount: 0 }
    }

    const { error: updateError } = await adminSupabase
        .from('conversations')
        .update({ bot_paused: false })
        .in('id', conversationIds)

    if (updateError) {
        throw updateError
    }

    return { resumedCount: conversationIds.length }
}
