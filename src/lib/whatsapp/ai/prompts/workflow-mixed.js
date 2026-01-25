
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
    💰 Total : (fais la somme) FCFA
    On continue ?"

ÉTAPE 2 - COLLECTE INFOS (LOGIQUE STRICTE):
    Analyse le panier ACTUEL :
    - Y a-t-il des produits PHYSIQUES ? (Oui/Non)
    - Y a-t-il des produits NUMÉRIQUES (Licence, Code, Ebook...) ? (Oui/Non)

    RÈGLES DE COLLECTE :
    1. Nom & Téléphone : TOUJOURS.
    2. 📍 Adresse : UNIQUEMENT SI produits Physiques présents.
    3. 📧 Email : ⛔ INTERDIT SI PAS DE PRODUIT NUMÉRIQUE.
                 ✅ OBLIGATOIRE seulement si un produit Numérique est dans le panier.

    Exemple Physique Seul : "Nom, Téléphone et Adresse svp." (PAS D'EMAIL !)
    Exemple Mixte : "Nom, Téléphone, Adresse (pour le colis) et Email (pour le code)."

ÉTAPE 3 - PAIEMENT:
    - Si panier 100% Physique : Demander "En ligne ou à la livraison ?"
    - Si panier 100% Numérique : Paiement en ligne obligatoire.
    - Si Mixte : "Pour la partie physique, en ligne ou livraison ? (Le numérique est payé en ligne)."

ÉTAPE 4 - RÉCAP FINAL (ADAPTATIF):
    - N'affiche la ligne "💻 Numérique" et l'email QUE SI applicable.
    
    Exemple Physique Seul :
    "📦 [Produits]
     📍 Livraison à [Adresse]
     💰 Total : (somme calculée) FCFA
     💳 Paiement : [Mode]
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
