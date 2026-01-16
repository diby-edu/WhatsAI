/**
 * ═══════════════════════════════════════════════════════════════
 * PROMPT BUILDER v2.3 - PATCH VARIANTES
 * ═══════════════════════════════════════════════════════════════
 * 
 * Ce fichier contient UNIQUEMENT les sections à REMPLACER dans
 * votre prompt-builder.js existant pour corriger le bug des variantes.
 * 
 * INSTRUCTIONS D'INTÉGRATION :
 * 1. Ouvrir src/lib/whatsapp/ai/prompt-builder.js
 * 2. Remplacer le PRINCIPE 3 par la version ci-dessous
 * 3. Ajouter le NOUVEAU PRINCIPE 3bis après le Principe 3
 * 4. Mettre à jour la section "TES OUTILS D'ACTION"
 */

// ═══════════════════════════════════════════════════════════════
// REMPLACER LE PRINCIPE 3 EXISTANT PAR CELUI-CI :
// ═══════════════════════════════════════════════════════════════

const PRINCIPE_3_UPDATED = `
🧩 PRINCIPE 3 : PRIX ET VARIANTES (⚠️ CRITIQUE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 RÈGLE ABSOLUE : Collecte TOUTES les variantes AVANT create_order

Si un produit a des VARIANTES (Taille, Couleur, etc.) :
1. Tu DOIS demander CHAQUE variante au client
2. Tu DOIS attendre sa réponse AVANT de passer à la suite
3. Tu NE PEUX PAS appeler create_order sans toutes les variantes

⚠️ ORDRE DE COLLECTE STRICT :
1️⃣ D'abord : Produit + Quantité
2️⃣ Ensuite : TOUTES les variantes (une par une si besoin)
3️⃣ Puis : Nom complet
4️⃣ Puis : Téléphone
5️⃣ Puis : Adresse livraison
6️⃣ Enfin : create_order avec selected_variants

EXEMPLE CORRECT :
Client : "Je veux 10 t-shirts"
Toi : "Quelle taille ? (Petite, Moyenne, Grande, XLarge)"
Client : "Moyenne"
Toi : "Et quelle couleur ? (Rouge, Bleu Marine, Noir, Or Premium)"
Client : "Bleu Marine"
Toi : "Parfait ! 10 T-Shirts taille Moyenne, couleur Bleu Marine.
       Pour finaliser, j'ai besoin de votre nom complet."
[...suite collecte infos...]
→ Puis tu appelles create_order avec:
   selected_variants: {"Taille": "Moyenne", "Couleur": "Bleu Marine"}

EXEMPLE INCORRECT (CE QUI CAUSAIT LE BUG) :
❌ Demander la taille → puis nom/tel/adresse → puis revenir à la couleur
❌ Appeler create_order sans les variantes → échec → re-demander
`

// ═══════════════════════════════════════════════════════════════
// AJOUTER CE NOUVEAU PRINCIPE 3bis (après Principe 3) :
// ═══════════════════════════════════════════════════════════════

const PRINCIPE_3BIS_NEW = `
🧩 PRINCIPE 3bis : FORMAT DES VARIANTES POUR create_order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quand tu appelles create_order, structure TOUJOURS ainsi :

{
  "items": [{
    "product_name": "T-Shirt Premium en coton bio",  // Nom EXACT du catalogue
    "quantity": 10,
    "selected_variants": {
      "Taille": "Moyenne",
      "Couleur": "Bleu Marine"
    }
  }],
  "customer_name": "Koli Koli",
  "customer_phone": "2250976536780",
  "delivery_address": "Port bouet 2"
}

⚠️ POINTS CRITIQUES :
- product_name = nom EXACT du produit (sans les variantes dedans)
- selected_variants = objet avec { "NomVariante": "ValeurChoisie" }
- Les noms de variantes doivent correspondre au catalogue

❌ MAUVAIS : product_name: "T-Shirt Premium taille Moyenne Bleu Marine"
✅ BON : product_name: "T-Shirt Premium en coton bio" + selected_variants
`

// ═══════════════════════════════════════════════════════════════
// METTRE À JOUR LA SECTION "TES OUTILS D'ACTION" :
// ═══════════════════════════════════════════════════════════════

const TOOLS_GUIDE_UPDATED = `
═══════════════════════════════════════════════════════
🔧 TES OUTILS D'ACTION
═══════════════════════════════════════════════════════

📦 create_order : Créer commande
   → OBLIGATOIRE : Toutes les variantes dans "selected_variants"
   → Si tu oublies une variante, l'outil échouera !
   → Format: items[].selected_variants = {"Variante": "Valeur"}

   EXEMPLE D'APPEL CORRECT :
   {
     "items": [{
       "product_name": "T-Shirt Premium en coton bio",
       "quantity": 10,
       "selected_variants": {
         "Taille": "Moyenne", 
         "Couleur": "Bleu Marine"
       }
     }],
     "customer_name": "Koli Koli",
     "customer_phone": "2250976536780",
     "delivery_address": "Port bouet 2"
   }

📅 create_booking : Créer réservation (services uniquement)

🔍 check_payment_status : Vérifier paiement ⭐ CRUCIAL
   → Utilise pour TOUS les flux
   → Retourne status: 'pending' | 'paid' | 'pending_delivery' | 'delivered'

📸 send_image : Envoyer image produit
`

// ═══════════════════════════════════════════════════════════════
// FONCTION MISE À JOUR POUR buildCatalogueSection
// (Rendre les variantes plus visibles dans le prompt)
// ═══════════════════════════════════════════════════════════════

function buildCatalogueSection_v23(products, currency) {
    if (!products || products.length === 0) {
        return `
═══════════════════════════════════════════════════════
📦 CATALOGUE PRODUITS/SERVICES
═══════════════════════════════════════════════════════
Aucun produit configuré
`
    }

    const catalogueItems = products.map(p => {
        const typeIcon = p.product_type === 'service' ? '🛎️ SERVICE' :
            p.product_type === 'virtual' ? '💻 NUMÉRIQUE' : '📦 PRODUIT'

        let priceDisplay = p.price_fcfa
            ? `${p.price_fcfa.toLocaleString()} ${currency === 'XOF' ? 'FCFA' : currency}`
            : 'Prix selon variante'

        // 🔧 FIX v2.3 : Afficher les variantes de manière plus explicite
        let variantsInfo = ''
        if (p.variants && p.variants.length > 0) {
            variantsInfo = '\n   ⚠️ VARIANTES OBLIGATOIRES :'
            for (const v of p.variants) {
                const optionsList = v.options.map(o => {
                    if (typeof o === 'string') return o
                    const price = o.price ? ` (+${o.price} ${currency})` : ''
                    return `${o.value || o.name}${price}`
                }).join(', ')
                variantsInfo += `\n      • ${v.name} (${v.type === 'fixed' ? 'choix unique' : 'supplément'}): ${optionsList}`
            }
            variantsInfo += '\n      → DEMANDE TOUTES LES VARIANTES AVANT create_order !'
        }

        const leadFieldsInfo = p.lead_fields && p.lead_fields.length > 0
            ? '\n   📝 Infos à collecter : ' + p.lead_fields.map(f => f.name || f.label).join(', ')
            : ''

        const pitch = p.short_pitch
            ? `\n   💬 ${p.short_pitch}`
            : ''

        const stockInfo = p.stock_quantity !== undefined && p.stock_quantity !== -1
            ? `\n   📊 Stock : ${p.stock_quantity}`
            : ''

        return `
▸ ${p.name} - ${typeIcon}
   💰 ${priceDisplay}${stockInfo}
   📝 ${p.description || ''}${pitch}${variantsInfo}${leadFieldsInfo}
`
    }).join('\n')

    return `
═══════════════════════════════════════════════════════
📦 CATALOGUE PRODUITS/SERVICES
═══════════════════════════════════════════════════════
${catalogueItems}

⚠️ RAPPEL VARIANTES :
Si un produit a des variantes, tu DOIS les demander au client
et les inclure dans create_order via "selected_variants".
`
}

// Export pour référence
module.exports = {
    PRINCIPE_3_UPDATED,
    PRINCIPE_3BIS_NEW,
    TOOLS_GUIDE_UPDATED,
    buildCatalogueSection_v23
}
