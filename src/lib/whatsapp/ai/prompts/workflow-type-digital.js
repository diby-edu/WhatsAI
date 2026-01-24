
/**
 * Workflow pour PRODUITS NUMÉRIQUES uniquement (💻)
 */
function buildDigitalWorkflow(orders) {
    return `
📋 FLUX DE COMMANDE (MODE PRODUIT NUMÉRIQUE 💻):

⚠️ RÈGLES STRICTES :
- PAS d'adresse de livraison (c'est virtuel).
- PAIEMENT EN LIGNE OBLIGATOIRE (pas de cash).

ÉTAPE 1 - PRODUIT ET QUANTITÉ:
    - Quantité : "Combien de licences/ebooks ?"
    - Variantes : Scan catalogue (souvent aucune pour le numérique).

ÉTAPE 2 - MINI-RÉCAP PANIER:
    - Afficher : Qté x Prix.
    - Demander "On continue ?"

ÉTAPE 3 - INFOS CLIENT (EMAIL CRITIQUE):
${(orders && orders.length > 0) ? `
    👉 CLIENT CONNU :
      "Souhaitez-vous utiliser ces infos ?
      • Nom : ${orders[0].customer_name || 'Inconnu'}
      • Tél : ${orders[0].customer_phone || 'Inconnu'}"
      + "Quel est votre 📧 EMAIL pour la réception ?"
` : `
    👉 NOUVEAU CLIENT : Demander :
      • Nom complet
      • Téléphone (avec indicatif)
      • 📧 EMAIL (Obligatoire pour l'envoi)
`}
    🚫 NE DEMANDE PAS D'ADRESSE PHYSIQUE !

ÉTAPE 4 - PAIEMENT (AUTOMATIQUE):
    - 🚫 Ne pose PAS de question "Comment payer ?".
    - Dis juste : "Le paiement se fera en ligne sécurisé (CinetPay/Mobile Money)."
    - payment_method sera toujours 'online'.

ÉTAPE 5 - NOTES:
    - "Une note ou instruction pour cette commande ?"

ÉTAPE 6 - RÉCAP FINAL:
    "Récapitulatif :
    💻 *[Produits]* (Total: [Prix] FCFA)
    📧 Envoi à : [Email]
    💳 Paiement : En ligne (Automatique)
    📝 Note : [Note]
    
    Confirmez-vous ?"

ÉTAPE 7 - CONFIRMATION:
    - "Oui" → create_order(payment_method: 'online', email: ...)
    - 🛑 FIN DU FLUX.
`.trim()
}

module.exports = { buildDigitalWorkflow }
