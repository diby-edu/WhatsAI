/**
 * ═══════════════════════════════════════════════════════════════
 * TOOL : capture_lead
 * Enregistre les coordonnées d'un client intéressé (mode support)
 * ═══════════════════════════════════════════════════════════════
 */

async function handleCaptureLead(args, agentId, customerPhone, supabase) {
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

        const { error } = await supabase.from('leads').insert({
            agent_id:          agentId,
            user_id:           agent.user_id,
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
        })

        if (error) {
            console.error('capture_lead: erreur insertion', error)
            return JSON.stringify({ success: false, error: 'Erreur enregistrement lead' })
        }

        // 🔔 NOTIFICATION: Nouveau lead (non-bloquant)
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
