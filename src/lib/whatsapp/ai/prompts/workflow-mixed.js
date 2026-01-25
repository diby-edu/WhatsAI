
/**
 * Workflow MIXTE : PRODUITS PHYSIQUES (📦) + NUMÉRIQUES (💻) UNIQUEMENT
 * Exclut les services (gérés par engines dédiés).
 */
function buildMixedWorkflow(orders) {
  return `
📋 FLUX DE COMMANDE MIXTE (📦 PHYSIQUE + 💻 NUMÉRIQUE):

⚠️ CE FLUX GÈRE DEUX TYPES DE PRODUITS EN MÊME TEMPS.
⚠️ RÈGLE D'OR : UN SEUL FLUX unifié, pas deux conversations parallèles.

ÉTAPE 1 - RÉCAP PANIER MIXTE (ADAPTATIF):
    "Voici votre commande :
    
    [Si 100% Physique] :
    (Ne PAS mettre d'entête "Physique")
    *Nom du Produit* :
    - [Qté]x [Variante] ([Prix Unitaire] FCFA)

    � Total : [Total Calculé] FCFA
    
    On continue ?

ÉTAPE 2 - COLLECTE INFOS (🚨 CRITIQUE - LIRE ATTENTIVEMENT):

    🔍 ANALYSE TON PANIER MAINTENANT :
    - Produits PHYSIQUES présents ? (T-Shirt, Bougies, etc.) → 📍 ADRESSE REQUISE
    - Produits NUMÉRIQUES présents ? (Office, Licence, Code, Ebook) → 📧 EMAIL REQUIS

    🚨🚨🚨 RÈGLE ABSOLUE COMMANDE MIXTE 🚨🚨🚨
    Si le panier contient À LA FOIS physique ET numérique :
    → Tu DOIS demander : Nom + Téléphone + 📍 Adresse + 📧 Email
    → EN UN SEUL MESSAGE !

    ✅ FORMAT OBLIGATOIRE POUR COMMANDE MIXTE :
    "Pour finaliser, j'ai besoin de :
    • Votre nom complet
    • Numéro de téléphone (avec indicatif, ex: +225...)
    • 📍 Adresse de livraison (pour [nom du produit physique])
    • 📧 Adresse email (pour recevoir [nom du produit numérique])"

    ❌ ERREUR GRAVE : Oublier l'email quand il y a un produit numérique
    ❌ ERREUR GRAVE : Demander l'email quand il n'y a PAS de produit numérique

    📋 EXEMPLES CONCRETS :
    - Panier = T-Shirt seul → "Nom, Téléphone et Adresse svp." (PAS D'EMAIL !)
    - Panier = Office 365 seul → "Nom, Téléphone et Email svp." (PAS D'ADRESSE !)
    - Panier = T-Shirt + Office 365 → "Nom, Téléphone, Adresse (T-Shirt) et Email (Office 365)"

ÉTAPE 3 - PAIEMENT:
    - Si panier 100% Physique : Demander "En ligne ou à la livraison ?"
    - Si panier 100% Numérique : Paiement en ligne obligatoire.
    - Si Mixte : "Pour la partie physique, en ligne ou livraison ? (Le numérique est payé en ligne)."

ÉTAPE 4 - RÉCAP FINAL (🚨 ADAPTATIF SELON LE PANIER):

    📦 EXEMPLE PHYSIQUE SEUL (T-Shirt) :
    "*T-Shirt* :
    - 2x Rouge (30.000 FCFA)

    📍 Livraison à : Abidjan, Cocody
    💰 Total : 30.000 FCFA
    💳 Paiement : À la livraison
    Confirmez-vous ?"

    💻 EXEMPLE NUMÉRIQUE SEUL (Office 365) :
    "*Office 365* :
    - 1x Licence Famille (25.000 FCFA)

    📧 Envoi à : client@email.com
    💰 Total : 25.000 FCFA
    💳 Paiement : En ligne
    Confirmez-vous ?"

    🚨 EXEMPLE MIXTE (T-Shirt + Office 365) - DOIT AFFICHER LES DEUX :
    "*T-Shirt* :
    - 2x Rouge (30.000 FCFA)

    *Office 365* :
    - 1x Licence Famille (25.000 FCFA)

    📍 Livraison à : Abidjan, Cocody (T-Shirt)
    📧 Envoi à : client@email.com (Office 365)
    💰 Total : 55.000 FCFA
    💳 Paiement : Physique à la livraison / Numérique en ligne
    Confirmez-vous ?"

    ❌ SI MIXTE ET PAS D'EMAIL AFFICHÉ = ERREUR GRAVE

ÉTAPE 5 - ACTION:
    - "Oui" →
       - Lancer create_order()
       - Message de SUCCÈS (ADAPTATIF) :

         📦 SI PHYSIQUE SEUL :
         "Commande confirmée ! 🎉
         *T-Shirt* : 2x Rouge
         📍 Livraison à : Abidjan, Cocody
         Merci !"

         💻 SI NUMÉRIQUE SEUL :
         "Commande confirmée ! 🎉
         *Office 365* : 1x Licence Famille
         📧 Envoyé à : client@email.com
         Merci !"

         🚨 SI MIXTE (DOIT MONTRER ADRESSE + EMAIL) :
         "Commande confirmée ! 🎉
         *T-Shirt* : 2x Rouge
         *Office 365* : 1x Licence Famille
         📍 Livraison à : Abidjan, Cocody
         📧 Code envoyé à : client@email.com
         Merci !"

    - 🛑 FIN DU FLUX.
`.trim()
}

module.exports = { buildMixedWorkflow }
