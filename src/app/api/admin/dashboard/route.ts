import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user || user.user_metadata?.role !== 'admin') {
        return errorResponse('Non autorisé', 403)
    }

    const adminSupabase = createAdminClient()

    try {
        // Fetch User Stats
        const { count: userCount, error: userError } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })

        // Fetch Agent Stats
        const { count: agentCount, error: agentError } = await adminSupabase
            .from('agents')
            .select('*', { count: 'exact', head: true })

        // Fetch Recent Users
        const { data: recentUsers, error: recentError } = await adminSupabase
            .from('profiles')
            .select('full_name, email, created_at')
            .order('created_at', { ascending: false })
            .limit(5)

        // Count messages (approximate if column exists, else 0)
        // Check if total_messages exists by fetching 1 row
        let messageCount = 0
        const { data: oneAgent } = await adminSupabase.from('agents').select('total_messages').limit(1).single()
        if (oneAgent && 'total_messages' in oneAgent) {
            const { data: allAgents } = await adminSupabase.from('agents').select('total_messages')
            messageCount = allAgents?.reduce((sum: number, a: any) => sum + (a.total_messages || 0), 0) || 0
        }

        if (userError || agentError || recentError) {
            console.error('Error fetching dashboard stats', { userError, agentError, recentError })
            return errorResponse('Erreur DB', 500)
        }

        return successResponse({
            stats: {
                totalUsers: userCount || 0,
                activeAgents: agentCount || 0,
                totalMessages: messageCount,
                revenue: 0 // Placeholder
            },
            recentUsers: recentUsers || []
        })

    } catch (err) {
        console.error('Admin dashboard API error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
