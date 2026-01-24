
/**
 * Workflow MIXTE : PRODUITS PHYSIQUES (📦) + NUMÉRIQUES (💻) UNIQUEMENT
 * Exclut les services (gérés par engines dédiés).
 */
function buildMixedWorkflow(orders) {
    return `
📋 FLUX DE COMMANDE MIXTE (📦 PHYSIQUE + 💻 NUMÉRIQUE):

⚠️ CE FLUX GÈRE DEUX TYPES DE PRODUITS EN MÊME TEMPS.
⚠️ RÈGLE D'OR : UN SEUL FLUX unifié, pas deux conversations parallèles.

ÉTAPE 1 - RÉCAP PANIER MIXTE:
    "Voici votre commande :
    📦 *Physique* : [Détail]
    💻 *Numérique* : [Détail]
    💰 Total : [Total] FCFA
    On continue ?"

ÉTAPE 2 - COLLECTE INFOS UNIFIÉE:
    - Demander TOUTES les infos en UNE FOIS :
      • Nom & Téléphone (Toujours)
      • 📍 Adresse (pour les produits physiques 📦)
      • 📧 Email (pour les produits numériques 💻)

    Exemple : "J'ai besoin de votre nom, téléphone, adresse de livraison (pour le T-shirt) et email (pour la licence)."

ÉTAPE 3 - PAIEMENT (CAS CLÉ):
    - 💻 Numérique = TOUJOURS en ligne.
    - 📦 Physique = Choix (Ligne ou Cash).

    - Demander UNIQUEMENT pour la partie Physique :
      "Pour les produits physiques, souhaitez-vous payer en ligne ou à la livraison ? (Les produits numériques seront payés en ligne)."

    - Logique de Décision :
      1. Si Client choisit "EN LIGNE" pour physique → Tout est payé en ligne (1 seule commande unifiée).
      2. Si Client choisit "LIVRAISON" pour physique → SPLIT PAIEMENT (2 commandes créées).

ÉTAPE 4 - RÉCAP FINAL & CONFIRMATION:

    CAS A : TOUT EN LIGNE (Paiement unique)
    "Récapitulatif :
    📦 [Physique] (Livraison à [Adresse])
    💻 [Numérique] (Envoi à [Email])
    💰 Total : [Total] FCFA
    💳 Paiement : EN LIGNE (Global)
    Confirmez-vous ?"

    CAS B : PAIEMENTS SÉPARÉS (Cash + Ligne)
    "Récapitulatif :
    📦 [Physique] : Paiement à la livraison à [Adresse]
    💻 [Numérique] : Paiement en ligne (Envoi à [Email])
    💰 Total Global : [Total] FCFA
    ⚠️ Vous recevrez 2 confirmations distinctes.
    Confirmez-vous ?"

ÉTAPE 5 - ACTION:
    - "Oui" →
      - CAS A : create_order(items: [Tout], payment_method: 'online')
      - CAS B :
          1. create_order(items: [Physique], payment_method: 'cod')
          2. create_order(items: [Numérique], payment_method: 'online')
    - 🛑 FIN DU FLUX.
`.trim()
}

module.exports = { buildMixedWorkflow }
