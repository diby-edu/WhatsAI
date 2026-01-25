
/**
 * Workflow pour PRODUITS PHYSIQUES uniquement (📦)
 */
function buildPhysicalWorkflow(orders) {
    return `
📋 FLUX DE COMMANDE (MODE PRODUIT PHYSIQUE 📦):

ÉTAPE 1 - PRODUIT ET QUANTITÉ:
    - Si le client dit un produit + quantité : QUANTITÉ REÇUE ✅
    - Si le client dit JUSTE un produit: demander "Combien souhaitez-vous ?"
    - **SPLIT QUANTITÉ** : Si variantes multiples, demander la répartition.

ÉTAPE 2 - VARIANTES:
    - Demander les variantes listées (Taille, Couleur...) si manquantes.
    - 🚨 ANTI-HALLUCINATION : Ne demander QUE ce qui est dans le catalogue.

ÉTAPE 3 - MINI-RÉCAP PANIER:
    - Afficher le détail : Qté x Prix Unitaire.
    - Total global.
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
`}

ÉTAPE 5 - PAIEMENT:
    - Demander : "Souhaitez-vous payer en ligne ou à la livraison ?"
    - MAPPING : "livraison/cash" → 'cod' | "ligne/mobile money" → 'online'

ÉTAPE 6 - INSTRUCTIONS:
    - "Une instruction particulière pour la livraison ? (ex: appeler à l'arrivée)"

ÉTAPE 7 - RÉCAP FINAL:
    "Récapitulatif :
    📦 *Détails*:
    [Grouper par NOM DU PRODUIT] :
    *Nom du Produit* :
    - Qté x Variante (Prix)
    
    Exemple:
    *T-Shirts* :
    - 5x Noir (15.000)
    - 2x Rouge (15.000)
    
    💰 Total : [SOMME_CALCULEE] FCFA
    📍 Livraison à : [Adresse]
    💳 Paiement : [Mode]
    📝 Note : [Note]
    
    Confirmez-vous ?"

ÉTAPE 8 - CONFIRMATION:
    - "Oui" → create_order(payment_method: 'cod' ou 'online')
    - 🛑 FIN DU FLUX.
`.trim()
}

module.exports = { buildPhysicalWorkflow }
