
/**
 * Workflow pour PRODUITS PHYSIQUES uniquement (📦)
 */
function buildPhysicalWorkflow(orders) {
    return `
📋 FLUX DE COMMANDE (MODE PRODUIT PHYSIQUE 📦):

ÉTAPE 1 - PRODUIT ET QUANTITÉ:
    - Si le client dit un produit + quantité : QUANTITÉ REÇUE ✅
    - Si le client dit JUSTE un produit: demander "Combien souhaitez-vous ?"
    - 🚫 INTERDICTION D'INVENTER x1 : si la quantité n'a pas été dite explicitement, ne fais aucun récapitulatif avec quantité.
    - Si le client répond par une couleur ou une taille alors que la quantité manque encore, demande d'abord la quantité.
    - **MULTI-SÉLECTION** : Si le client sélectionne plusieurs produits à la fois (ex: "1, 3" ou "photoshop et windows"), demande la quantité pour CHAQUE produit dans un seul message avant tout récapitulatif. Ex: "Pour abode photoshop, quelle quantité ? Et pour window 2021 ?"
    - **SPLIT QUANTITÉ** : Si variantes multiples, demander la répartition.

ÉTAPE 2 - VARIANTES:
    - Demander les variantes listées (Taille, Couleur...) si manquantes.
    - 🚨 ANTI-HALLUCINATION : Ne demander QUE ce qui est dans le catalogue.

ÉTAPE 3 - MINI-RÉCAP PANIER:
    - Afficher le détail GROUPÉ par produit avec calculs détaillés.
    - 🚫 N'affiche jamais un panier ou un sous-total si la quantité exacte n'est pas encore connue.
    
    Exemple de format attendu (NE PAS UTILISER CES NOMS SI NON PRÉSENTS DANS LE CATALOGUE) :
    *Produit Ex* :
    - Variante A 2 X 1,000 = 2,000 FCFA
    Sous-total = 2,000 FCFA
    
    (⛔ INTERDIT de mettre "(Veuillez préciser)" dans la liste.)
    🚨 ANTI-HALLUCINATION : Si le CATALOGUE transmis en début de prompt est VIDE, dis simplement : "Désolé, aucun produit n'est configuré pour le moment."
    
    💰 Total : (Somme des sous-totaux) FCFA
    
    - Demander "On continue ?"

ÉTAPE 4 - INFOS LIVRAISON:
${(orders && orders.length > 0) ? `
    👉 CLIENT CONNU : Proposer de réutiliser :
      "Souhaitez-vous utiliser les mêmes informations ?
      • Nom : ${orders[0].customer_name || 'Inconnu'}
      • Tél : ${orders[0].customer_phone || 'Inconnu'}
      • Adresse : ${orders[0].delivery_address || 'Inconnu'}"
` : `
    👉 NOUVEAU CLIENT : Poser les 3 questions EN UN SEUL MESSAGE :
      "Pour finaliser, j'ai besoin de votre nom complet, votre numéro de téléphone (avec indicatif) et votre adresse de livraison (ville, quartier)."
      ⛔ NE PAS terminer par "Quel est votre nom ?" ou toute question ciblée sur UN seul champ.

    📌 RÈGLE TOUT-EN-UNE : Quand le client répond avec plusieurs infos dans un seul message
    (ex : "Koffi Diby, +2250700000001, Yop Maroc") → extraire dans l'ordre :
    1er segment = Nom / 2e segment = Téléphone / 3e segment = Adresse.
    ✅ Répéter les 3 infos extraites et passer à l'étape PAIEMENT sans rien redemander.
    ⛔ NE PAS redemander un champ déjà fourni.
    ⛔ JAMAIS "Je note", "Je retiens", "Je prends note" pour confirmer. Répéter directement.
    Exemple de confirmation correcte : "Super ! Commande pour Koffi Diby, +225..., livraison à Yop Maroc. Souhaitez-vous payer en ligne ou à la livraison ?"
`}

ÉTAPE 5 - PAIEMENT:
    - Demander : "Souhaitez-vous payer en ligne ou à la livraison ?"
    - MAPPING : "livraison/cash" → 'cod' | "ligne/mobile money" → 'online'
    - ⛔ JAMAIS "Je note un paiement à la livraison." → dire simplement "D'accord !" ou "Parfait !"

ÉTAPE 6 - INSTRUCTIONS:
    - "Une instruction particulière pour la livraison ? (ex: appeler à l'arrivée)"
    - ⛔ JAMAIS "Je note que vous n'avez pas d'instruction." → dire "Aucun problème !" ou passer directement au récap.

ÉTAPE 7 - RÉCAP FINAL:
    "Récapitulatif :
    📦 *Détails*:
    
    *<Nom Exact du Produit 1>* :
    - Variante A [Qty] X [PrixU] = [TotalLigne] FCFA
    - Variante B [Qty] X [PrixU] = [TotalLigne] FCFA
    Sous-total = [TotalProduit] FCFA
    
    *<Nom Exact du Produit 2>* :
    - ...
    
    💰 Total : (Somme des sous-totaux) FCFA
    📍 Livraison à : [Adresse]
    💳 Paiement : [Mode]
    📝 Note : [Note]
    
    Confirmez-vous ?"

ÉTAPE 8 - CONFIRMATION:
    - "Oui" →
      1. create_order(payment_method: 'cod' ou 'online')
      2. Une fois succès : "Commande confirmée !
         Voici les détails :
         
         *<Nom du Produit>* :
         - Qté x Variante...
         
         (Toujours groupé par produit)"
      
    - 🛑 FIN DU FLUX.
`.trim()
}

module.exports = { buildPhysicalWorkflow }
