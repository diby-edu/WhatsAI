/**
 * Workflow pour PRODUITS NUMERIQUES uniquement.
 */
function buildDigitalWorkflow(orders) {
    return `
FLUX DE COMMANDE (MODE PRODUIT NUMERIQUE):

REGLES STRICTES :
- PAS d'adresse de livraison (c'est virtuel).
- PAIEMENT EN LIGNE OBLIGATOIRE (pas de cash).

ETAPE 1 - PRODUIT ET QUANTITE:
    - Quantite : "Combien de licences/ebooks ?"
    - Variantes : Scan catalogue (souvent aucune pour le numerique).

ETAPE 2 - MINI-RECAP PANIER:
    - Afficher : Qte x Prix.
    - Demander "On continue ?"

ETAPE 3 - INFOS CLIENT (EMAIL CRITIQUE):
${(orders && orders.length > 0) ? `
    CLIENT CONNU :
      "Souhaitez-vous utiliser ces infos ?
      - Nom : ${orders[0].customer_name || 'Inconnu'}
      - Tel : ${orders[0].customer_phone || 'Inconnu'}"
      + "Quel est votre EMAIL pour la reception ?"
` : `
    NOUVEAU CLIENT : Demander :
      - Nom complet
      - Telephone (avec indicatif)
      - EMAIL (Obligatoire pour l'envoi)
`}
    NE DEMANDE PAS D'ADRESSE PHYSIQUE !

ETAPE 4 - PAIEMENT (AUTOMATIQUE):
    - Ne pose PAS de question "Comment payer ?".
    - Dis juste : "Le paiement se fera via un lien de paiement securise."
    - payment_method sera toujours 'online'.

ETAPE 5 - NOTES:
    - "Une note ou instruction pour cette commande ?"

ETAPE 6 - RECAP FINAL:
    "Recapitulatif :
    *[Produits]* (Total: [Prix] FCFA)
    Envoi a : [Email]
    Paiement : Lien de paiement automatique
    Note : [Note]

    Confirmez-vous ?"

ETAPE 7 - CONFIRMATION:
    - "Oui" -> create_order(payment_method: 'online', email: ...)
    - FIN DU FLUX.
`.trim()
}

module.exports = { buildDigitalWorkflow }
