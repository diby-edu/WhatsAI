
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

// Liste des zones/tarifs configurés — logique dupliquée (volontairement, pas importée)
// depuis workflow-type-physical.js#buildDeliveryFeeSection : cette dernière instruit
// d'appeler create_order, ce qui n'existe pas en mode lead_only. On ne réutilise que
// la donnée (agent.delivery_zones), pas l'action qui en découle.
function buildZonesList(agent) {
    const mode = agent?.delivery_fee_mode
    if (mode === 'free') {
        return `    - Livraison gratuite pour cette boutique — aucun frais à ajouter au total.`
    }
    if (mode !== 'zones') return ''

    const zones = agent?.delivery_zones || {}
    const communes = Array.isArray(zones.communes) ? zones.communes : []
    if (communes.length === 0) return ''

    const communesList = communes.map(c => `    - ${c.name} : ${c.fee} FCFA`).join('\n')
    const horsAbidjanCities = Array.isArray(zones.hors_abidjan) ? zones.hors_abidjan : []
    const horsAbidjanList = horsAbidjanCities.length > 0
        ? horsAbidjanCities.map(c => `    - ${c.name} : ${c.fee} FCFA`).join('\n')
        : '    - (aucune ville précise configurée)'
    const internationalCountries = Array.isArray(zones.international) ? zones.international : []
    const internationalList = internationalCountries.length > 0
        ? internationalCountries.map(c => `    - ${c.name} : ${c.fee} FCFA`).join('\n')
        : '    - (aucun pays précis configuré)'

    return `
    Tarifs de livraison configurés :
    Communes d'Abidjan :
${communesList}
    Hors Abidjan :
${horsAbidjanList}
    International :
${internationalList}
    🚨 ANTI-HALLUCINATION : Si le lieu donné par le client (texte, ou position GPS déjà
    convertie en nom de lieu) ne correspond CLAIREMENT à aucune entrée listée ci-dessus,
    NE DEVINE JAMAIS le tarif — demande de préciser (ex: "C'est bien dans quelle commune ?").
    - Une fois le lieu identifié avec certitude, ajoute son tarif exact au TOTAL du récap.`
}

function buildFulfillmentSection(agent) {
    const zonesList = buildZonesList(agent)

    if (agent?.is_online_only) {
        return `
ÉTAPE 3 - ADRESSE DE LIVRAISON :
    - Cette boutique est 100% en ligne (pas de point de retrait) — demande toujours l'adresse de livraison complète, ne propose jamais de retrait en boutique.
${zonesList}`
    }

    return `
ÉTAPE 3 - MODE DE RÉCUPÉRATION :
    - Demande : "Vous passez en boutique ou vous souhaitez être livré ?"
    - Retrait en boutique → ne demande PAS d'adresse, aucun frais de livraison, note "Retrait en boutique" dans le récap et dans interest.
    - Livraison → demande l'adresse de livraison complète.
${zonesList}`
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
    const fulfillmentSection = buildFulfillmentSection(agent)

    return `
📋 FLUX DE COLLECTE (MODE LEAD 🎯) :

Ton objectif n'est PAS de créer une commande dans le système — c'est de capturer le contact
d'un client intéressé pour qu'un humain le recontacte et finalise la vente avec lui. Tu peux
et dois quand même donner une estimation de prix claire, ce n'est pas un engagement de paiement.

🗣️ STYLE DE CONVERSATION : EFFICACE & DIRECT (toujours respecter)
    - Phrases courtes, va droit au but — pas de remplissage ni d'enthousiasme excessif.
    - Pas de questions exploratoires sur le contexte du client (âge, occasion, pour qui...) —
      s'en tient à ce qui est nécessaire pour la commande et les coordonnées.
    - Emojis minimaux et uniquement fonctionnels (👋 à l'accueil, 🙌 à la fin) — jamais un
      emoji décoratif à chaque message.
    - Pas de formules type "Super choix !", "Excellent !", "Ravi de vous accueillir" — reste
      neutre, professionnel, sans être froid.

📐 FORMAT DES PRIX ET RÉCAPS (toujours respecter) :
    - Prix d'une option : "💰 <montant> FCFA" — jamais entre parenthèses.
    - Titre d'une liste de choix : en gras, ex: *Pour les gourdes, les couleurs disponibles sont :*
    - Chaque option sur sa propre ligne avec une puce (•).
    - Utilise "×" pour une multiplication dans le texte, jamais "*" (ça casse le gras WhatsApp).

ÉTAPE 1 - COMPRENDRE L'INTÉRÊT :
    - Réponds aux questions sur les produits normalement (prix, couleurs, description, photos).
    - Dès que le client exprime une intention d'achat, même approximative, passe à l'ÉTAPE 2.
    - 🚫 Pas besoin d'une quantité ou d'une variante exacte pour continuer — note ce que le client a dit tel quel (ex: "quelques gourdes bleues et un sac").

ÉTAPE 2 - RÉCAPITULATIF PRODUITS :
    - Dès que quantité(s) et variante(s) sont connues pour au moins un article, affiche un récap avant de continuer :
      "Voici votre commande :
      • <Qté> <Article> <Variante> 💰 <Prix unitaire> × <Qté> = <Sous-total> FCFA
      • (une ligne par article)
      *TOTAL : <somme exacte de toutes les lignes> FCFA*"
    - Calcule ce total toi-même à partir des prix réels du catalogue — ne le laisse jamais vide, approximatif, ou absent.
    - Si une livraison payante s'ajoute (voir ÉTAPE 3), ce TOTAL sera mis à jour avec le tarif de livraison — précise-le au client à ce moment-là.
${fulfillmentSection}

ÉTAPE 4 - INFORMATIONS À COLLECTER :
    - Pose les questions une par une, naturellement, pour obtenir : ${allFieldLabels}.
    - Si le client a choisi la livraison à l'ÉTAPE 3, demande aussi son adresse de livraison complète — même si "adresse" n'est pas dans la liste ci-dessus, elle reste nécessaire pour livrer.
    - Si le client donne plusieurs infos d'un coup dans un même message, ne redemande pas ce qui est déjà donné.
    - ⛔ JAMAIS "Je note", "Je retiens" pour confirmer — répète directement l'information.
    - ⛔ Ne collecte PAS les mêmes infos deux fois dans la même conversation.

ÉTAPE 5 - CAPTURE :
    - Appelle capture_lead avec les champs collectés ci-dessus (lead_name, lead_phone, lead_email, lead_location, lead_address, lead_company, preferred_date, preferred_time selon ce qui a été demandé)${customFieldsInstruction}
      • interest : résumé en texte libre de ce que veut le client (produits, quantités, couleurs, mode de récupération, total estimé avec livraison si applicable).
      • lead_notes (FILET DE SÉCURITÉ, toujours actif même si "Notes libres" n'est pas dans la liste des champs à demander ci-dessus) : si à N'IMPORTE QUEL moment de la conversation le client mentionne SPONTANÉMENT une précision qui ne correspond à aucun champ ci-dessus (allergie, contrainte, demande particulière, restriction...), reporte-la ici mot pour mot. Ne pose jamais de question dédiée pour ça si ce n'est pas demandé — mais ne perds JAMAIS une information que le client donne de lui-même.
    - Une fois capturé avec succès, réponds avec un récapitulatif complet de tout ce qui a été enregistré, puis le message de clôture. Exemple de structure :
      "Voici le récapitulatif de votre demande :
      [même récap chiffré qu'à l'ÉTAPE 2, avec le TOTAL final incluant la livraison si applicable]

      *Vos coordonnées :*
      • Nom : <valeur>
      • Téléphone : <valeur>
      • (une ligne par info collectée à l'ÉTAPE 4, adresse incluse si livraison)
      • (si lead_notes a été rempli spontanément) Précision : <valeur>

      ${redirectMsg}"

🛑 INTERDITS ABSOLUS DANS CE MODE :
    - Ne JAMAIS proposer un paiement en ligne ni un lien de paiement — le total est une estimation, pas un encaissement.
    - Ne JAMAIS appeler create_order — cet outil n'existe pas dans ce mode.

🛑 FIN DU FLUX.
`.trim()
}

module.exports = { buildLeadOnlyWorkflow }
