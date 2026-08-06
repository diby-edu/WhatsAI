
/**
 * Workflow MODE LEAD ONLY (🎯)
 * Agent avec catalogue (produits/images/variantes) mais sans commande structurée :
 * l'objectif est de capturer le contact d'un client intéressé (capture_lead) pour
 * qu'un humain le recontacte et finalise — pas de create_order, pas de paiement.
 *
 * Les champs à collecter sont configurables par le marchand (Paramètres de l'agent
 * → "Activer la collecte de leads" → "Informations à collecter"), exactement le même
 * réglage (lead_collect_fields / lead_custom_fields / lead_redirect_message) que celui
 * déjà utilisé pour le mode Support Client — pas de nouveau réglage à créer.
 */

const FIELD_LABELS = {
    name: 'prénom/nom',
    phone: 'numéro de téléphone (avec indicatif)',
    email: 'email',
    location: 'localisation/quartier',
    address: 'adresse de livraison complète',
    company: 'entreprise',
    preferred_date: 'date souhaitée',
    preferred_time: 'heure souhaitée',
    service_requested: 'service ou prestation souhaité',
    notes: 'informations complémentaires',
}

function buildLeadOnlyWorkflow(agent = {}) {
    const fields = Array.isArray(agent.lead_collect_fields) && agent.lead_collect_fields.length > 0
        ? agent.lead_collect_fields
        : (typeof agent.lead_collect_fields === 'string'
            ? (JSON.parse(agent.lead_collect_fields || '[]').length > 0 ? JSON.parse(agent.lead_collect_fields) : ['name', 'phone'])
            : ['name', 'phone'])

    const customFields = Array.isArray(agent.lead_custom_fields)
        ? agent.lead_custom_fields
        : (typeof agent.lead_custom_fields === 'string' ? JSON.parse(agent.lead_custom_fields || '[]') : [])

    const standardLabels = fields.map(f => FIELD_LABELS[f] || f)
    const allFieldLabels = [...standardLabels, ...customFields].join(', ')
    const customFieldsInstruction = customFields.length > 0
        ? `\n      • Champs personnalisés à collecter : ${customFields.join(', ')} → stocke-les dans custom_fields`
        : ''

    const redirectMsg = agent.lead_redirect_message || 'Merci ! Notre équipe vous recontacte rapidement pour finaliser.'

    return `
📋 FLUX DE COLLECTE (MODE LEAD 🎯) :

Ton objectif n'est PAS de construire une commande exacte — c'est de capturer le contact
d'un client intéressé pour qu'un humain le recontacte et finalise la vente avec lui.

ÉTAPE 1 - COMPRENDRE L'INTÉRÊT :
    - Réponds aux questions sur les produits normalement (prix, couleurs, description, photos).
    - Dès que le client exprime une intention d'achat, même approximative, passe à l'ÉTAPE 2.
    - 🚫 Pas besoin d'une quantité ou d'une variante exacte pour continuer — note ce que le client a dit tel quel (ex: "quelques gourdes bleues et un sac").

ÉTAPE 2 - INFORMATIONS À COLLECTER :
    - Pose les questions une par une, naturellement, pour obtenir : ${allFieldLabels}.
    - Si le client donne plusieurs infos d'un coup dans un même message, ne redemande pas ce qui est déjà donné.
    - ⛔ JAMAIS "Je note", "Je retiens" pour confirmer — répète directement l'information.
    - ⛔ Ne collecte PAS les mêmes infos deux fois dans la même conversation.

ÉTAPE 3 - CAPTURE :
    - Appelle capture_lead avec les champs collectés ci-dessus (lead_name, lead_phone, lead_email, lead_location, lead_company, preferred_date, preferred_time selon ce qui a été demandé)${customFieldsInstruction}
      • interest : résumé en texte libre de ce que veut le client (produits, quantités approximatives, couleurs mentionnées) — pas besoin que ce soit structuré ou exact au chiffre près.
    - Une fois capturé avec succès, réponds EXACTEMENT : "${redirectMsg}"

🛑 INTERDITS ABSOLUS DANS CE MODE :
    - Ne JAMAIS annoncer un total exact ni un récapitulatif de commande chiffré.
    - Ne JAMAIS proposer un paiement en ligne ni un lien de paiement.
    - Ne JAMAIS appeler create_order — cet outil n'existe pas dans ce mode.

🛑 FIN DU FLUX.
`.trim()
}

module.exports = { buildLeadOnlyWorkflow }
