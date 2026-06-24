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
    - Si le client indique un seul produit sans quantite : demander "Combien souhaitez-vous en commander ?"
    - 🚫 INTERDICTION D'INVENTER x1 : si la quantite n'a pas ete dite explicitement, ne fais aucun recapitulatif avec quantite.
    - **MULTI-SELECTION** : Si le client selectionne plusieurs produits a la fois (ex: "1, 3" ou "photoshop et windows"), demande la quantite pour CHAQUE produit dans un seul message avant tout recapitulatif. Ex: "Pour abode photoshop, quelle quantite ? Et pour window 2021 ?"
    - Variantes : Scan catalogue (souvent aucune pour le numerique).

ETAPE 2 - PASSAGE DIRECT AU CHECKOUT:
    - Une fois la quantite validee, enchainez directement sur les infos client.
    - Ne revenez pas sur un menu panier generique si le panier est 100% numerique.

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
    - Ne pose PAS de question de mode de paiement (Mobile Money, carte...).
    - payment_method est TOUJOURS 'online'. Ne le demande JAMAIS au client.
    - Le systeme genere le lien de paiement automatiquement apres create_order.

ETAPE 5 - RECAP FINAL (PAS DE NOTES):
    "Recapitulatif :
    *[Produits]* (Total: [Prix réels en FCFA — utiliser le prix du catalogue])
    📧 Envoi a : [Email]
    💳 Paiement : En ligne (lien securise)

    Confirmez-vous ?"
    ⛔ PAS de "Délai de livraison". La livraison est INSTANTANEE apres paiement.
    ⛔ PAS de [prix du guide] ou [insérer le montant] — utiliser le vrai prix du catalogue.
    ⛔ PAS de champ Adresse physique dans le recap.

ETAPE 6 - CONFIRMATION:
    - "Oui" -> create_order(payment_method: 'online', email: ...)
    - FIN DU FLUX.
`.trim()
}

module.exports = { buildDigitalWorkflow }
