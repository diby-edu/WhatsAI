import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { requireAdminAccess } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

// GET - Get broadcast history
export async function GET(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const { data: broadcasts, error } = await adminSupabase
            .from('broadcasts')
            .select(`
                id,
                agent_id,
                message,
                recipients_count,
                created_at,
                status
            `)
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            if (error.code === '42P01') {
                return successResponse({ broadcasts: [], message: 'Table not created' })
            }
            throw error
        }

        // Get agent names
        const broadcastsWithDetails = await Promise.all(
            (broadcasts || []).map(async (b: any) => {
                let agentName = null
                if (b.agent_id) {
                    const { data: agent } = await adminSupabase
                        .from('agents')
                        .select('name')
                        .eq('id', b.agent_id)
                        .single()
                    agentName = agent?.name
                }
                return { ...b, agent_name: agentName }
            })
        )

        return successResponse({ broadcasts: broadcastsWithDetails })
    } catch (err) {
        console.error('Admin broadcasts error:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST - Send a new broadcast
export async function POST(request: NextRequest) {
    const { adminSupabase, response } = await requireAdminAccess()
    if (response || !adminSupabase) return response!

    try {
        const body = await request.json()
        const { agentId, message, recipientType = 'agent_conversations' } = body

        if (!agentId || !message?.trim()) {
            return errorResponse('agentId and message are required', 400)
        }

        // Récupérer les destinataires selon le type
        let uniquePhones: string[] = []

        if (recipientType === 'escalation_phones') {
            const { data: agents, error: agentsError } = await adminSupabase
                .from('agents')
                .select('escalation_phone')
                .not('escalation_phone', 'is', null)

            if (agentsError) throw agentsError
            uniquePhones = [...new Set(agents?.map((a: any) => a.escalation_phone).filter(Boolean) || [])]
        } else {
            // Mode par défaut : conversations de l'agent
            const { data: conversations, error: convError } = await adminSupabase
                .from('conversations')
                .select('contact_phone')
                .eq('agent_id', agentId)

            if (convError) throw convError
            uniquePhones = [...new Set(conversations?.map((c: any) => c.contact_phone) || [])]
        }

        if (uniquePhones.length === 0) {
            return errorResponse('Aucun destinataire trouvé', 400)
        }

        // Créer le log broadcast d'abord pour obtenir l'ID
        const { data: broadcastLog, error: logError } = await adminSupabase
            .from('broadcasts')
            .insert({
                agent_id: agentId,
                message: message.trim(),
                recipients_count: uniquePhones.length,
                status: 'sending',
                created_at: new Date().toISOString()
            })
            .select('id')
            .single()

        if (logError) {
            console.warn('Could not log broadcast:', logError)
        }

        const broadcastId = broadcastLog?.id || null

        // Mettre en queue les messages
        const outboundMessages = uniquePhones.map(phone => ({
            agent_id: agentId,
            recipient_phone: phone,
            message_content: message.trim(),
            status: 'pending',
            broadcast_id: broadcastId,
            created_at: new Date().toISOString()
        }))

        const { error: insertError } = await adminSupabase
            .from('outbound_messages')
            .insert(outboundMessages)

        if (insertError && insertError.code !== '42P01') {
            throw insertError
        }

        return successResponse({
            success: true,
            broadcastId,
            recipientCount: uniquePhones.length,
            message: `Broadcast en file pour ${uniquePhones.length} destinataires`
        })
    } catch (err) {
        console.error('Error sending broadcast:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
