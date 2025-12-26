import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

interface Message {
    created_at: string
    role: string
}

interface Conversation {
    created_at: string
}

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d

    try {
        const now = new Date()
        let startDate: Date

        switch (period) {
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                break
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                break
            default: // 7d
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        }

        // Get user's first agent for message filtering
        const { data: agentData } = await supabase
            .from('agents')
            .select('id')
            .eq('user_id', user.id)
            .limit(1)
            .single()

        const agentId = agentData?.id || ''

        // Get messages by day
        const { data: messagesData } = await supabase
            .from('messages')
            .select('created_at, role')
            .eq('agent_id', agentId)
            .gte('created_at', startDate.toISOString())

        const messages: Message[] = messagesData || []

        // Get conversations
        const { data: conversationsData } = await supabase
            .from('conversations')
            .select('created_at')
            .eq('user_id', user.id)
            .gte('created_at', startDate.toISOString())

        const conversations: Conversation[] = conversationsData || []

        // Aggregate by day
        const dailyStats: Record<string, { messages: number; incoming: number; outgoing: number; conversations: number }> = {}

        // Initialize days
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
        for (let i = 0; i < days; i++) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
            const key = date.toISOString().split('T')[0]
            dailyStats[key] = { messages: 0, incoming: 0, outgoing: 0, conversations: 0 }
        }

        // Count messages
        messages.forEach((msg) => {
            const key = new Date(msg.created_at).toISOString().split('T')[0]
            if (dailyStats[key]) {
                dailyStats[key].messages++
                if (msg.role === 'user') {
                    dailyStats[key].incoming++
                } else {
                    dailyStats[key].outgoing++
                }
            }
        })

        // Count conversations
        conversations.forEach((conv) => {
            const key = new Date(conv.created_at).toISOString().split('T')[0]
            if (dailyStats[key]) {
                dailyStats[key].conversations++
            }
        })

        // Convert to array sorted by date
        const chartData = Object.entries(dailyStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, stats]) => ({
                date,
                label: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                ...stats
            }))

        // Summary stats
        const totalMessages = messages.length
        const totalIncoming = messages.filter(m => m.role === 'user').length
        const totalOutgoing = messages.filter(m => m.role === 'assistant').length
        const totalConversations = conversations.length

        // Get credits used
        const { data: profile } = await supabase
            .from('profiles')
            .select('credits_balance, credits_used_this_month')
            .eq('id', user.id)
            .single()

        return successResponse({
            period,
            chartData,
            summary: {
                totalMessages,
                totalIncoming,
                totalOutgoing,
                totalConversations,
                avgMessagesPerDay: Math.round(totalMessages / days),
                avgResponseRate: totalIncoming > 0 ? Math.round((totalOutgoing / totalIncoming) * 100) : 0,
                creditsBalance: profile?.credits_balance || 0,
                creditsUsedThisMonth: profile?.credits_used_this_month || 0
            }
        })
    } catch (err) {
        console.error('Error fetching analytics:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
