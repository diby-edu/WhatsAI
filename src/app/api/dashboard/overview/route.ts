import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse(authError || 'Unauthorized', 401)
    }

    try {
        // Fetch User Profile (Plan info and name)
        const { data: profile } = await supabase
            .from('profiles')
            .select('plan, credits_balance, full_name')
            .eq('id', user.id)
            .single()

        // Fetch Active Subscription for expiry date
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('current_period_end, status')
            .eq('user_id', user.id)
            .in('status', ['active', 'past_due'])
            .order('current_period_end', { ascending: false })
            .limit(1)
            .single()

        // Fetch Agents with real data
        const { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('id, name, is_active, total_messages')
            .eq('user_id', user.id)

        if (agentsError) throw agentsError

        // Get conversation count PER AGENT
        const agentIds = agents?.map(a => a.id) || []
        const agentsWithConversations = await Promise.all(
            (agents || []).map(async (agent) => {
                const { count } = await supabase
                    .from('conversations')
                    .select('*', { count: 'exact', head: true })
                    .eq('agent_id', agent.id)

                return {
                    ...agent,
                    total_conversations: count || 0
                }
            })
        )

        // Get real total conversation count
        const { count: conversationCount } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)

        // Get total messages from messages table for accurate count
        let totalMessages = 0
        if (agentIds.length > 0) {
            const { count: messageCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('agent_id', agentIds)
            totalMessages = messageCount || 0
        }

        // Get recent conversations with last message
        const { data: recentConvs } = await supabase
            .from('conversations')
            .select(`
                id,
                contact_phone,
                contact_push_name,
                updated_at,
                agent:agents(name)
            `)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(5)

        // Get last message for each conversation
        const recentConversations = await Promise.all(
            (recentConvs || []).map(async (c: any) => {
                const { data: lastMsg } = await supabase
                    .from('messages')
                    .select('content')
                    .eq('conversation_id', c.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                return {
                    id: c.id,
                    contact: c.contact_push_name || formatPhoneNumber(c.contact_phone),
                    time: formatRelativeTime(c.updated_at),
                    lastMessage: lastMsg?.content?.substring(0, 50) || '',
                    status: 'active',
                    agentName: c.agent?.name || 'Agent'
                }
            })
        )

        return successResponse({
            stats: {
                totalMessages,
                activeAgents: agentsWithConversations?.filter(a => a.is_active).length || 0,
                totalConversations: conversationCount || 0,
                plan: profile?.plan || 'Free',
                credits: profile?.credits_balance || 0,
                subscriptionExpiry: subscription?.current_period_end || null,
                userName: profile?.full_name || ''
            },
            agents: agentsWithConversations,
            recentConversations
        })

    } catch (err) {
        console.error('Dashboard overview API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// Helper to format phone number for display
function formatPhoneNumber(phone: string): string {
    if (!phone) return 'Inconnu'
    // Clean WhatsApp suffixes
    const clean = phone.replace(/@s\.whatsapp\.net|@lid|@g\.us/g, '')

    // Format with proper spacing for readability
    if (clean.length >= 11) {
        // Format: +XXX XXX XXX XXX
        const countryCode = clean.substring(0, 3)
        const rest = clean.substring(3)
        const formatted = rest.replace(/(\d{3})(?=\d)/g, '$1 ')
        return '+' + countryCode + ' ' + formatted.trim()
    }
    return '+' + clean
}

// Helper to format relative time
function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`
    return date.toLocaleDateString('fr-FR')
}
