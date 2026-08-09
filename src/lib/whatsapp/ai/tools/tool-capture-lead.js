/**
 * ═══════════════════════════════════════════════════════════════
 * TOOL : capture_lead
 * Enregistre les coordonnées d'un client intéressé (mode support)
 * ═══════════════════════════════════════════════════════════════
 */

async function handleCaptureLead(args, agentId, customerPhone, conversationId, supabase) {
    try {
        console.log('Executing tool: capture_lead', args)
        const {
            lead_name, lead_phone, lead_email, lead_location, lead_address, lead_company,
            interest, preferred_date, preferred_time, service_requested, lead_notes, custom_fields
        } = args

        // Récupérer le user_id de l'agent
        const { data: agent, error: agentErr } = await supabase
            .from('agents')
            .select('user_id, name')
            .eq('id', agentId)
            .single()

        if (agentErr || !agent) {
            console.error('capture_lead: agent introuvable', agentErr)
            return JSON.stringify({ success: false, error: 'Agent introuvable' })
        }

        // Dernier panier calculé par preview_cart et dernier lien de localisation résolu —
        // stockés en cours de conversation (conversation.metadata), jamais reconstruits à
        // partir de ce que l'IA rapporte : garantit un total/lieu fidèles à ce qui a été
        // réellement calculé, même si l'IA les omet ou les déforme dans son résumé texte.
        let leadCart = null
        let locationLink = null
        if (conversationId) {
            const { data: conversation } = await supabase
                .from('conversations')
                .select('metadata')
                .eq('id', conversationId)
                .single()
            leadCart = conversation?.metadata?.lead_cart || null
            locationLink = conversation?.metadata?.last_location_link || null
        }

        const leadRow = {
            agent_id:          agentId,
            user_id:           agent.user_id,
            conversation_id:   conversationId   || null,
            customer_phone:    customerPhone    || null,
            lead_name:         lead_name        || null,
            lead_phone:        lead_phone       || null,
            lead_email:        lead_email       || null,
            lead_location:     lead_location    || null,
            lead_address:      lead_address     || null,
            lead_company:      lead_company     || null,
            interest:          interest         || null,
            preferred_date:    preferred_date   || null,
            preferred_time:    preferred_time   || null,
            service_requested: service_requested || null,
            lead_notes:        lead_notes       || null,
            custom_fields:     (custom_fields && Object.keys(custom_fields).length > 0) ? custom_fields : null,
            estimated_total:   leadCart?.total ?? null,
            delivery_fee:      leadCart?.deliveryFee ?? null,
            items:             leadCart?.items ?? null,
            location_link:     locationLink     || null,
        }

        // Idempotent par conversation : une même conversation peut redéclencher
        // capture_lead plusieurs fois (client qui corrige son numéro, ajoute une
        // instruction, ou filet de sécurité qui rappelle l'outil) — on met à jour
        // le lead existant au lieu d'en créer un doublon à chaque fois.
        let isNewLead = true
        if (conversationId) {
            const { data: existingLead } = await supabase
                .from('leads')
                .select('id')
                .eq('conversation_id', conversationId)
                .maybeSingle()

            if (existingLead) {
                isNewLead = false
                const { error: updateErr } = await supabase.from('leads').update(leadRow).eq('id', existingLead.id)
                if (updateErr) {
                    console.error('capture_lead: erreur mise à jour', updateErr)
                    return JSON.stringify({ success: false, error: 'Erreur mise à jour lead' })
                }
            }
        }

        if (isNewLead) {
            const { error } = await supabase.from('leads').insert(leadRow)
            if (error) {
                console.error('capture_lead: erreur insertion', error)
                return JSON.stringify({ success: false, error: 'Erreur enregistrement lead' })
            }
        }

        // 🔔 NOTIFICATION: Nouveau lead uniquement (non-bloquant) — pas de notification
        // répétée à chaque mise à jour du même lead.
        if (isNewLead) {
            try {
                const { notify } = require('../../../notifications/notify')
                notify(agent.user_id, 'new_lead', {
                    contactName: lead_name || undefined,
                    contactPhone: lead_phone || undefined,
                    agentName: agent.name,
                })
            } catch (notifyError) {
                console.error('🔔 new_lead notification error (non-blocking):', notifyError)
            }
        }

        return JSON.stringify({
            success: true,
            action:  'capture_lead',
            message: 'Lead enregistré avec succès',
        })
    } catch (err) {
        console.error('capture_lead: erreur inattendue', err)
        return JSON.stringify({ success: false, error: 'Erreur interne' })
    }
}

module.exports = { handleCaptureLead }
