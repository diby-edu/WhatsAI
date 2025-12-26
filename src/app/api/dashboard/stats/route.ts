import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError) {
        return errorResponse(authError, 401)
    }

    // Get profile with credits
    const { data: profile } = await supabase
        .from('profiles')
        .select('plan, credits_balance, credits_used_this_month')
        .eq('id', user!.id)
        .single()

    // Get agent count
    const { count: agentCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)

    // Get active agents count
    const { count: activeAgentCount } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .eq('whatsapp_connected', true)

    // Get conversation stats
    const { count: totalConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)

    const { count: activeConversations } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'active')

    // Get message count this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    // Get user's agent IDs first
    const { data: userAgents } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user!.id)

    const agentIds = (userAgents?.map(a => a.id) || []) as string[]

    const { count: messagesThisMonth } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString())
        .in('agent_id', agentIds.length > 0 ? agentIds : ['none'])

    // Get leads stats
    const { count: totalLeads } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .not('lead_status', 'is', null)

    const { count: convertedLeads } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('lead_status', 'converted')

    // Get recent conversations
    const { data: recentConversations } = await supabase
        .from('conversations')
        .select(`
      id,
      contact_name,
      contact_phone,
      contact_push_name,
      last_message_text,
      last_message_at,
      unread_count,
      agent:agents(id, name)
    `)
        .eq('user_id', user!.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(5)

    // Get agents overview
    const { data: agents } = await supabase
        .from('agents')
        .select('id, name, is_active, whatsapp_connected, total_conversations, total_messages')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5)

    const stats = {
        profile: {
            plan: profile?.plan || 'free',
            credits_balance: profile?.credits_balance || 0,
            credits_used_this_month: profile?.credits_used_this_month || 0,
        },
        agents: {
            total: agentCount || 0,
            active: activeAgentCount || 0,
        },
        conversations: {
            total: totalConversations || 0,
            active: activeConversations || 0,
        },
        messages: {
            this_month: messagesThisMonth || 0,
        },
        leads: {
            total: totalLeads || 0,
            converted: convertedLeads || 0,
            conversion_rate: totalLeads ? Math.round((convertedLeads || 0) / totalLeads * 100) : 0,
        },
        recent_conversations: recentConversations || [],
        agents_overview: agents || [],
    }

    return successResponse({ stats })
}
