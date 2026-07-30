
/**
 * Workflow pour PRODUITS PHYSIQUES uniquement (📦)
 */

function buildDeliveryFeeSection(agent) {
    const mode = agent?.delivery_fee_mode

    if (mode === 'free') {
        return `
ÉTAPE 4.5 - LIVRAISON GRATUITE:
    - La livraison est gratuite pour cette boutique — tu peux le mentionner au client si utile.
    - Aucun frais a ajouter au total.
`
    }

    if (mode !== 'zones') return ''

    const zones = agent?.delivery_zones || {}
    const communes = Array.isArray(zones.communes) ? zones.communes : []
    if (communes.length === 0) return ''

    const communesList = communes.map(c => {
        const quartiers = Array.isArray(c.quartiers) && c.quartiers.length > 0
            ? ` (quartiers a tarif different : ${c.quartiers.map(q => `${q.name} = ${q.fee} FCFA`).join(', ')})`
            : ''
        return `    - ${c.name} : ${c.fee} FCFA${quartiers}`
    }).join('\n')

    const horsAbidjanNote = zones.hors_abidjan?.note || 'tarif communique apres validation par notre equipe'
    const internationalNote = zones.international?.note || 'nous contacter pour un devis'

    return `
ÉTAPE 4.5 - FRAIS DE LIVRAISON (obligatoire avant paiement, produit physique):
    Tarifs de livraison configures pour cette boutique :
${communesList}
    - Hors Abidjan (autre ville) : ${horsAbidjanNote}
    - International (autre pays) : ${internationalNote}

    - Determine dans quelle commune d'Abidjan (ou hors Abidjan / international) le client souhaite etre livre, a partir de l'adresse donnee a l'ETAPE 4 ou en demandant si ce n'est pas clair.
    🚨 ANTI-HALLUCINATION : Si le client mentionne un lieu precis (quartier, carrefour, repere local) qui ne correspond CLAIREMENT a aucune commune listee ci-dessus, NE DEVINE JAMAIS la commune. Demande explicitement : "C'est bien dans quelle commune, [lieu mentionne] ?"
    - Une fois la commune identifiee avec certitude, tu peux annoncer le tarif exact (il est dans la liste ci-dessus).
    - Appelle create_order avec delivery_zone_type="abidjan_commune" et delivery_commune=<commune exacte de la liste> (+ delivery_quartier si precise). Hors Abidjan : delivery_zone_type="hors_abidjan". A l'etranger : delivery_zone_type="international".
    - Le montant final facture est toujours calcule par le systeme au moment de create_order, jamais par toi.
`
}

function buildPhysicalWorkflow(orders, agent) {
    const deliveryFeeSection = buildDeliveryFeeSection(agent)
    return `
📋 FLUX DE COMMANDE (MODE PRODUIT PHYSIQUE 📦):

ÉTAPE 1 - PRODUIT ET QUANTITÉ:
    - Si le client dit un produit + quantité : QUANTITÉ REÇUE ✅
    - Si le client dit JUSTE un produit: demander "Combien souhaitez-vous ?"
    - 🚫 INTERDICTION D'INVENTER x1 : si la quantité n'a pas été dite explicitement, ne fais aucun récapitulatif avec quantité.
    - Si le client répond par une couleur ou une taille alors que la quantité manque encore, demande d'abord la quantité.
    - **MULTI-SÉLECTION** : Si le client sélectionne plusieurs produits à la fois (ex: "1, 3" ou "adobe et office") :
      ⛔ INTERDIT ABSOLU : poser plusieurs questions de quantité dans le même message.
      ⛔ INTERDIT ABSOLU : passer aux infos client tant que TOUS les produits n'ont pas leur quantité.
      Règle : un seul message = une seule question de quantité. Attendre la réponse avant de poser la suivante.
      Exemple CORRECT pour 2 produits sélectionnés :
        → Message 1 : "Pour adobe photoshop, quelle quantité souhaitez-vous ?"
        → Client répond : "2"  (= quantité pour adobe photoshop. PAS un choix de produit.)
        → Message 2 : "Et pour office 2021, quelle quantité ?"
        → Client répond : "1"  (= quantité pour office 2021.)
        → Seulement maintenant → passe à l'étape suivante.
      Exemple INTERDIT :
        ❌ "Pour adobe, quelle quantité ? Et pour office, quelle quantité ?" (deux questions = INTERDIT)
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
${deliveryFeeSection}
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
    
    💰 Sous-total produits : (Somme des sous-totaux) FCFA${(agent?.delivery_fee_mode === 'zones' || agent?.delivery_fee_mode === 'free') ? `
    🚚 Livraison ([Commune ou "gratuite"]) : [Montant confirmé à l'ÉTAPE 4.5] FCFA
    💰 Total (produits + livraison) : [Somme] FCFA` : `
    💰 Total : (Somme des sous-totaux) FCFA`}
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
