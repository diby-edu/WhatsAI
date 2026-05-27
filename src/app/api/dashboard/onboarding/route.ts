import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse(authError || 'Unauthorized', 401)

    try {
        const [agentsRes, knowledgeRes, productsRes, conversationsRes] = await Promise.all([
            supabase.from('agents').select('id, whatsapp_connected, mission, ecommerce_mode', { count: 'exact' }).eq('user_id', user.id),
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

        // KB : non requise si tous les agents sont external_sync (produits via API)
        // Si aucun agent, on considère que la KB est requise (étape pas encore complétable)
        const needsKnowledge = agentCount === 0 || agents.some((a: any) => a.ecommerce_mode !== 'external_sync')
        // Produits manuels : non requis si tous les agents sont support_client ou external_sync
        // Si aucun agent, on considère que les produits sont requis (étape pas encore complétable)
        const needsManualProducts = agentCount === 0 || agents.some((a: any) => a.mission !== 'support_client' && a.ecommerce_mode !== 'external_sync')

        const steps = [
            { key: 'agent_created', done: agentCount > 0 },
            { key: 'whatsapp_connected', done: whatsappConnected },
            {
                key: 'knowledge_added',
                done: !needsKnowledge || knowledgeCount > 0,
                note: !needsKnowledge ? 'Vos produits sont synchronisés via API — base de connaissances non requise.' : null,
            },
            ...(needsManualProducts ? [{ key: 'products_added', done: productCount > 0 }] : [
                { key: 'products_added', done: true, note: 'Catalogue synchronisé automatiquement via votre API produits.' }
            ]),
            { key: 'first_conversation', done: conversationCount > 0 },
        ]

        const allDone = steps.every(s => s.done)

        return successResponse({ steps, allDone })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
