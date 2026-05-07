import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse(authError || 'Unauthorized', 401)

    try {
        const [agentsRes, knowledgeRes, productsRes, conversationsRes] = await Promise.all([
            supabase.from('agents').select('id, whatsapp_connected, mission', { count: 'exact' }).eq('user_id', user.id),
            supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        ])

        const agents = agentsRes.data || []
        const agentCount = agentsRes.count || 0
        const whatsappConnected = agents.some((a: any) => a.whatsapp_connected === true)
        const knowledgeCount = knowledgeRes.count || 0
        const productCount = productsRes.count || 0
        const conversationCount = conversationsRes.count || 0

        // Étape produits : pertinente seulement si au moins un agent n'est pas support_client
        const needsProducts = agents.some((a: any) => a.mission !== 'support_client')

        const steps = [
            { key: 'agent_created', done: agentCount > 0 },
            { key: 'whatsapp_connected', done: whatsappConnected },
            { key: 'knowledge_added', done: knowledgeCount > 0 },
            ...(needsProducts ? [{ key: 'products_added', done: productCount > 0 }] : []),
            { key: 'first_conversation', done: conversationCount > 0 },
        ]

        const allDone = steps.every(s => s.done)

        return successResponse({ steps, allDone })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
