import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { getAdminSupabase } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
        return errorResponse('Unauthorized', 401)
    }

    try {
        // Get user's conversations with agent info and message counts


        // Apply filters
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const bot_paused = url.searchParams.get('bot_paused')

        const query = supabase
            .from('conversations')
            .select(`
                id,
                contact_phone,
                contact_push_name,
                status,
                bot_paused,
                created_at,
                updated_at,
                agent:agents(id, name)
            `)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })

        if (status) query.eq('status', status)
        if (bot_paused === 'true') query.eq('bot_paused', true)
        if (bot_paused === 'false') query.eq('bot_paused', false)

        const { data: conversations, error } = await query

        if (error) {
            return errorResponse('Erreur serveur', 500)
        }

        if ((conversations || []).length === 0) {
            return successResponse({ conversations: [] })
        }

        // RPC : comptage et dernier message en une seule requête SQL côté serveur
        // Évite le problème de limite URL avec .in() sur 400+ IDs
        const supabaseAdmin = getAdminSupabase()
        const { data: stats, error: statsError } = await supabaseAdmin
            .rpc('get_message_stats_for_user', { user_id_param: user.id })

        if (statsError) {
            console.error('[conversations] get_message_stats_for_user error:', statsError)
        }

        const statsMap: Record<string, { count: number; last_message: string; last_message_at: string }> = {}
        ;(stats || []).forEach((s: any) => {
            statsMap[s.conversation_id] = {
                count: Number(s.message_count) || 0,
                last_message: s.last_message || '',
                last_message_at: s.last_message_at || '',
            }
        })

        // Combine data
        const conversationsWithDetails = (conversations || []).map((conv: any) => ({
            ...conv,
            messages_count: statsMap[conv.id]?.count || 0,
            last_message: statsMap[conv.id]?.last_message || '',
            last_message_at: statsMap[conv.id]?.last_message_at || conv.updated_at,
        }))

        return successResponse({ conversations: conversationsWithDetails })
    } catch (err) {
        console.error('Error in conversations API:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
