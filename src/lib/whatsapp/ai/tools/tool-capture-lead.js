/**
 * ═══════════════════════════════════════════════════════════════
 * TOOL : capture_lead
 * Enregistre les coordonnées d'un client intéressé (mode support)
 * ═══════════════════════════════════════════════════════════════
 */

async function handleCaptureLead(args, agentId, customerPhone, supabase) {
    try {
        console.log('Executing tool: capture_lead', args)
        const { lead_name, lead_phone, lead_email, lead_location, lead_company, interest } = args

        // Récupérer le user_id de l'agent
        const { data: agent, error: agentErr } = await supabase
            .from('agents')
            .select('user_id')
            .eq('id', agentId)
            .single()

        if (agentErr || !agent) {
            console.error('capture_lead: agent introuvable', agentErr)
            return JSON.stringify({ success: false, error: 'Agent introuvable' })
        }

        const { error } = await supabase.from('leads').insert({
            agent_id:       agentId,
            user_id:        agent.user_id,
            customer_phone: customerPhone || null,
            lead_name:      lead_name     || null,
            lead_phone:     lead_phone    || null,
            lead_email:     lead_email    || null,
            lead_location:  lead_location || null,
            lead_company:   lead_company  || null,
            interest:       interest      || null,
        })

        if (error) {
            console.error('capture_lead: erreur insertion', error)
            return JSON.stringify({ success: false, error: 'Erreur enregistrement lead' })
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
