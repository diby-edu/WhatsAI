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
    - **MULTI-SELECTION** : Si le client selectionne plusieurs produits a la fois (ex: "1, 3" ou "adobe et office") :
      ⛔ INTERDIT ABSOLU : poser plusieurs questions de quantite dans le meme message.
      ⛔ INTERDIT ABSOLU : passer aux infos client tant que TOUS les produits n'ont pas leur quantite.
      Regle : un seul message = une seule question de quantite. Attendre la reponse avant de poser la suivante.
      Exemple CORRECT pour 2 produits selectionnes :
        → Message 1 : "Pour adobe photoshop, quelle quantite souhaitez-vous ?"
        → Client repond : "2"  (= quantite pour adobe photoshop. PAS un choix de produit.)
        → Message 2 : "Et pour office 2021, quelle quantite ?"
        → Client repond : "1"  (= quantite pour office 2021.)
        → Seulement maintenant → passe aux infos client.
      Exemple INTERDIT :
        ❌ "Pour adobe, quelle quantite ? Et pour office, quelle quantite ?" (deux questions = INTERDIT)
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
    Afficher TOUS les produits du panier (ne pas en oublier un seul) :
    "Recapitulatif :
    • [Produit 1] x [Qte 1] = [Total ligne 1] FCFA
    • [Produit 2] x [Qte 2] = [Total ligne 2] FCFA
    ...
    💰 Total : [Somme] FCFA
    📧 Envoi a : [Email]
    💳 Paiement : En ligne (lien securise)

    Tapez *oui* pour confirmer ou *modifier* pour changer."
    ⛔ PAS de "Délai de livraison". La livraison est INSTANTANEE apres paiement.
    ⛔ PAS de [prix du guide] ou [insérer le montant] — utiliser le vrai prix du catalogue.
    ⛔ PAS de champ Adresse physique dans le recap.
    ⛔ NE PAS utiliser de menus numérotés (1. Continuer / 2. Modifier) — utiliser des mots clés uniquement.

ETAPE 6 - CONFIRMATION:
    - "oui" / "ok" / "confirmer" -> create_order(payment_method: 'online', email: ...) avec TOUS les produits du panier.
    - "modifier" -> demander ce que le client veut changer.
    - FIN DU FLUX.
`.trim()
}

module.exports = { buildDigitalWorkflow }
