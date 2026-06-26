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

ETAPE 2 - INFOS CLIENT (EMAIL CRITIQUE):
    Une fois la/les quantites validees, demander directement les infos UNE PAR UNE. Pas de menu panier entre les deux.
${(orders && orders.length > 0) ? `
    CLIENT CONNU :
      "Souhaitez-vous utiliser ces infos ?
      - Nom : ${orders[0].customer_name || 'Inconnu'}
      - Tel : ${orders[0].customer_phone || 'Inconnu'}"
      + "Quel est votre EMAIL pour la reception ?"
` : `
    NOUVEAU CLIENT : Demander dans cet ordre, un champ a la fois :
      1. Nom complet
      2. Telephone (avec indicatif)
      3. EMAIL (Obligatoire pour l'envoi)
`}
    NE DEMANDE PAS D'ADRESSE PHYSIQUE !

ETAPE 3 - PAIEMENT (AUTOMATIQUE):
    - Ne pose PAS de question "Comment payer ?".
    - payment_method est TOUJOURS 'online'. Ne le demande JAMAIS au client.
    - Le systeme genere le lien de paiement automatiquement apres create_order.

ETAPE 4 - RECAP FINAL:
    Le systeme affiche automatiquement le recap complet (panier + infos client).
    Format attendu :
    "*Recapitulatif de votre commande*

    🛒 *Produits*
    • [nom] x [qte] = [total] FCFA
    ...

    👤 *Vos infos*
    • Nom : ...
    • Tel : ...
    • Email : ...
    • Paiement : En ligne

    *Total : ... FCFA*

    Confirmez-vous ?
    → *oui* — confirmer la commande
    → *modifier infos* — changer nom / tel / email
    → *modifier produit* — changer les produits"
    ⛔ PAS de menus numerotes (1. Confirmer / 2. Modifier).
    ⛔ PAS de champ Adresse physique.
    ⛔ PAS de "Délai de livraison" — livraison INSTANTANEE apres paiement.

ETAPE 5 - CONFIRMATION:
    - "oui" / "ok" / "confirmer" -> create_order(payment_method: 'online', email: ...) avec TOUS les produits.
    - "modifier infos" -> proposer de corriger nom / tel / email.
    - "modifier produit" -> retour au panier pour ajout / suppression / changement de quantite.
    - FIN DU FLUX.
`.trim()
}

module.exports = { buildDigitalWorkflow }
