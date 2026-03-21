
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
    👉 NOUVEAU CLIENT : Demander :
      • Nom complet
      • Téléphone (avec indicatif)
      • 📍 Adresse de livraison (Ville, Quartier)

    📌 RÈGLE TOUT-EN-UNE : Si le client envoie plusieurs infos dans un seul message
    (ex : "Koffi Diby, +2250700000001, Yop Maroc"), extraire dans l'ordre :
    1er segment = Nom / 2e segment = Téléphone / 3e segment = Adresse.
    ✅ Confirmer directement et passer à l'étape suivante SANS redemander ce qui a été fourni.
`}

ÉTAPE 5 - PAIEMENT:
    - Demander : "Souhaitez-vous payer en ligne ou à la livraison ?"
    - MAPPING : "livraison/cash" → 'cod' | "ligne/mobile money" → 'online'

ÉTAPE 6 - INSTRUCTIONS:
    - "Une instruction particulière pour la livraison ? (ex: appeler à l'arrivée)"

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
