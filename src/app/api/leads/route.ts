import { NextRequest } from 'next/server'
import { createApiClient, createAdminClient, getAuthUser, errorResponse, successResponse } from '@/lib/api-utils'
import { notify } from '@/lib/notifications/notification.service'
import { triggerWebhooks } from '@/lib/webhooks/webhook.service'

// GET /api/leads?agentId=xxx — leads d'un agent spécifique
// GET /api/leads — tous les leads de l'utilisateur (tous agents)
export async function GET(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const agentId = request.nextUrl.searchParams.get('agentId')

    try {
        if (agentId) {
            // Mode par agent : vérifier que l'agent appartient à l'utilisateur
            const { data: agent } = await supabase
                .from('agents')
                .select('id')
                .eq('id', agentId)
                .eq('user_id', user.id)
                .single()

            if (!agent) return errorResponse('Agent introuvable', 404)

            const { data: leads, error } = await supabase
                .from('leads')
                .select('*')
                .eq('agent_id', agentId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return successResponse({ leads: leads || [] })
        }

        // Mode global : tous les leads de l'utilisateur avec nom d'agent
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*, agents(id, name)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        const enriched = (leads || []).map((l: any) => ({
            ...l,
            agent_name: l.agents?.name || '—',
        }))

        return successResponse({ leads: enriched })
    } catch (err) {
        console.error('Error fetching leads:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// POST /api/leads — créer un lead et notifier le propriétaire de l'agent
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { agent_id, user_id, name, phone, email, notes, source } = body

        if (!agent_id || !user_id) return errorResponse('agent_id et user_id requis', 400)

        const adminSupabase = createAdminClient()

        // Vérifier que l'agent existe et récupérer son propriétaire + nom
        const { data: agent } = await adminSupabase
            .from('agents')
            .select('id, name, user_id')
            .eq('id', agent_id)
            .single()

        if (!agent) return errorResponse('Agent introuvable', 404)

        // Insérer le lead
        const { data: lead, error } = await adminSupabase
            .from('leads')
            .insert({
                agent_id,
                user_id: agent.user_id,
                name: name || null,
                phone: phone || null,
                email: email || null,
                notes: notes || null,
                source: source || 'whatsapp',
            })
            .select()
            .single()

        if (error) throw error

        // Notifier le propriétaire de l'agent (fire & forget)
        notify(agent.user_id, 'new_lead', {
            contactName: name || undefined,
            contactPhone: phone || undefined,
            agentName: agent.name,
        }).catch(() => { })

        // Déclencher les webhooks lead.collected (fire & forget)
        triggerWebhooks(agent.user_id, 'lead.collected', {
            lead_id: lead.id,
            agent_id: agent_id,
            agent_name: agent.name,
            name: name || null,
            phone: phone || null,
            email: email || null,
            source: source || 'whatsapp',
        }).catch(() => { })

        return successResponse({ lead })
    } catch (err) {
        console.error('Error creating lead:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// PATCH /api/leads?id=xxx — mettre à jour le statut traité/non traité et/ou les notes internes d'un lead
export async function PATCH(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const leadId = request.nextUrl.searchParams.get('id')
    if (!leadId) return errorResponse('id requis', 400)

    try {
        const body = await request.json()
        const updates: Record<string, unknown> = {}

        if (typeof body.is_treated === 'boolean') {
            updates.is_treated = body.is_treated
            updates.treated_at = body.is_treated ? new Date().toISOString() : null
        }
        if (typeof body.merchant_notes === 'string') {
            updates.merchant_notes = body.merchant_notes.trim() || null
        }
        if (Object.keys(updates).length === 0) {
            return errorResponse('is_treated (boolean) ou merchant_notes (string) requis', 400)
        }

        const { data: lead, error } = await supabase
            .from('leads')
            .update(updates)
            .eq('id', leadId)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) throw error

        return successResponse({ lead })
    } catch (err) {
        console.error('Error updating lead:', err)
        return errorResponse('Erreur serveur', 500)
    }
}

// DELETE /api/leads?id=xxx — supprimer un lead
export async function DELETE(request: NextRequest) {
    const supabase = await createApiClient()
    const { user, error: authError } = await getAuthUser(supabase)
    if (authError || !user) return errorResponse('Unauthorized', 401)

    const leadId = request.nextUrl.searchParams.get('id')
    if (!leadId) return errorResponse('id requis', 400)

    try {
        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', leadId)
            .eq('user_id', user.id)

        if (error) throw error

        return successResponse({ deleted: true })
    } catch (err) {
        console.error('Error deleting lead:', err)
        return errorResponse('Erreur serveur', 500)
    }
}
