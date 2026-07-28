import { NextRequest } from 'next/server'
import { createApiClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse(authError || 'Unauthorized', 401)

    try {
        const [agentsRes, knowledgeRes, productsRes, conversationsRes, platformRes] = await Promise.all([
            supabase.from('agents').select('id, name, whatsapp_connected, mission, ecommerce_mode', { count: 'exact' }).eq('user_id', user.id),
            supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('api_platform_connections').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        ])

        const agents = agentsRes.data || []
        const agentCount = agentsRes.count || 0
        const whatsappConnected = agents.some((a: any) => a.whatsapp_connected === true)
        const knowledgeCount = knowledgeRes.count || 0
        const productCount = productsRes.count || 0
        const conversationCount = conversationsRes.count || 0
        const platformConnectionCount = platformRes.count || 0

        const apiAgents = agents.filter((a: any) => a.ecommerce_mode === 'external_sync')
        const hasApiAgent = apiAgents.length > 0

        const agentName = (a: any) => String(a.name || '').trim() || 'Agent sans nom'
        const namesList = (list: any[]) => list.map(agentName).join(', ')

        // KB requise uniquement pour les agents support non-API
        const knowledgeAgents = agents.filter((a: any) => a.mission === 'support_client' && a.ecommerce_mode !== 'external_sync')
        const nonKnowledgeAgents = agents.filter((a: any) => !(a.mission === 'support_client' && a.ecommerce_mode !== 'external_sync'))
        // Si aucun agent : on considère qu'elle est requise (étape verrouillée)
        const needsKnowledge = agentCount === 0 || knowledgeAgents.length > 0

        // Produits requis si au moins un agent n'est ni support ni API
        const productAgents = agents.filter((a: any) => a.mission !== 'support_client' && a.ecommerce_mode !== 'external_sync')
        const nonProductAgents = agents.filter((a: any) => !(a.mission !== 'support_client' && a.ecommerce_mode !== 'external_sync'))
        // Si aucun agent : on considère qu'ils sont requis (étape verrouillée)
        const needsManualProducts = agentCount === 0 || productAgents.length > 0

        const step1Done = agentCount > 0
        const step2Done = whatsappConnected
        const step3Done = !needsKnowledge || knowledgeCount > 0
        const step4Done = !needsManualProducts || productCount > 0
        const platformConfigured = platformConnectionCount > 0

        // Notes contextuelles — affichées uniquement si un agent existe.
        // Avec plusieurs agents de types différents, on nomme les agents concernés
        // pour que l'étape (requise ou non) ne semble pas incohérente.
        const knowledgeNote = !step1Done
            ? null
            : needsKnowledge
                ? (knowledgeAgents.length > 0 && nonKnowledgeAgents.length > 0
                    ? `Requis pour : ${namesList(knowledgeAgents)}. Pas nécessaire pour vos autres agents.`
                    : null)
                : hasApiAgent
                    ? 'Vos produits sont synchronisés via API — base de connaissances non requise.'
                    : 'Optionnel — ajoutez des connaissances pour améliorer les réponses de votre agent.'

        const productsNote = !step1Done
            ? null
            : needsManualProducts
                ? (productAgents.length > 0 && nonProductAgents.length > 0
                    ? `Requis pour : ${namesList(productAgents)}. Pas nécessaire pour vos agents Support ou synchronisés API.`
                    : null)
                : hasApiAgent
                    ? 'Catalogue synchronisé automatiquement via votre API produits.'
                    : 'Agent support — aucun catalogue produits requis.'

        // Étape plateforme : verrouillée si WhatsApp non connecté, absente pour agents non-API
        const platformStep = hasApiAgent ? [{
            key: 'platform_configured',
            done: platformConfigured,
            locked: step2Done === false,
            note: apiAgents.length < agentCount ? `Concerne : ${namesList(apiAgents)}.` : null,
        }] : []

        // first_conversation verrouillée tant que toutes les étapes requises ne sont pas faites
        const firstConvLocked = step2Done === false
            || step3Done === false
            || step4Done === false
            || (hasApiAgent && platformConfigured === false)

        const steps = [
            { key: 'agent_created',      done: step1Done,             locked: false,                                    note: null },
            { key: 'whatsapp_connected', done: step2Done,             locked: step1Done === false,                      note: null },
            { key: 'knowledge_added',    done: step3Done,             locked: agentCount === 0 && needsKnowledge,       note: knowledgeNote },
            { key: 'products_added',     done: step4Done,             locked: agentCount === 0 && needsManualProducts,  note: productsNote },
            ...platformStep,
            { key: 'first_conversation', done: conversationCount > 0, locked: firstConvLocked,                         note: null },
        ]

        // Texte bannière — pointe toujours vers la prochaine étape requise
        let nextAction: string
        if (step1Done === false) {
            nextAction = 'Créez votre premier agent IA pour démarrer'
        } else if (step2Done === false) {
            nextAction = 'Connectez un numéro WhatsApp à votre agent pour recevoir des messages'
        } else if (hasApiAgent && platformConfigured === false) {
            nextAction = 'Configurez votre connexion plateforme dans le module Développeurs'
        } else if (step3Done === false) {
            nextAction = 'Ajoutez des connaissances pour que votre agent réponde correctement'
        } else if (step4Done === false) {
            nextAction = 'Ajoutez vos produits pour que votre agent puisse prendre des commandes'
        } else {
            nextAction = 'Envoyez un message à votre numéro WhatsApp pour tester votre agent'
        }

        const allDone = steps.every(s => s.done)
        return successResponse({ steps, allDone, nextAction })
    } catch (err: any) {
        return errorResponse(err.message || 'Erreur serveur', 500)
    }
}
