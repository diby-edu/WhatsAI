# UX Refactor — Corrections & Améliorations Bot WhatsApp

**Date :** 2026-03-21
**Périmètre :** Bot WhatsApp — collecte de commande, affichage produits, gestion des variantes

---

## Vue d'ensemble

Cette session couvre deux niveaux d'intervention :

1. **Corrections de bugs** bloquants ou générant des boucles client
2. **Refonte UX affichage produits** : niveaux N1/N2/N3 + commande multi-produits

La documentation technique de l'affichage N1/N2/N3 et du flux multi-produits se trouve dans
[`CART_MULTIPRODUCT_UX_2026-03-21.md`](./CART_MULTIPRODUCT_UX_2026-03-21.md).

---

## Partie 1 — Corrections de bugs

### Bug 1 — SQL : `column reference "order_number" is ambiguous`
**Fichier :** `supabase/migrations/20260319_fix_order_number_ambiguity.sql`
**Symptôme :** Toutes les créations de commande échouaient avec cette erreur PostgreSQL.
**Cause :** `RETURNS TABLE(order_number TEXT)` crée un paramètre OUT implicite `order_number`
qui entre en conflit avec la colonne `orders.order_number` dans la clause `RETURNING`.
**Fix :**
```sql
-- Avant
RETURNING id, order_number INTO v_order_id, v_order_number;

-- Après
RETURNING id, orders.order_number INTO v_order_id, v_order_number;
```
**Action requise :** Appliquer manuellement la migration dans le dashboard Supabase.

---

### Bug 2 — preCheck re-demandait les variantes au client
**Fichier :** `src/lib/whatsapp/ai/generator.js` — `preCheckCreateOrder`
**Symptôme :** Quand une variante était manquante dans `selected_variants`, le message
d'erreur demandait à l'IA de "demander au client de choisir", déclenchant une question
répétitive alors que le client avait déjà fourni l'information.
**Fix :** Message reformulé pour dire à l'IA de retrouver la valeur dans l'historique :
```javascript
error: `Variante "${variantName}" absente ou invalide dans selected_variants. ` +
    `Le client l'a déjà précisée dans la conversation : retrouve la valeur et rappelle ` +
    `create_order IMMÉDIATEMENT. NE REDEMANDE PAS au client. Options valides : ${options}.`
```

---

### Bug 3 — `partial_combos` ignorait les variantes re-spécifiées
**Fichier :** `src/lib/whatsapp/services/cart-state.service.js` — handler `partial_combos`
**Symptôme :** Client dit "3 Noir M et 5 Rouge XL" après que le bot avait stocké Noire/L et
Rouge/XL → le handler assignait les quantités aux anciens combos (L) au lieu des nouveaux (M).
**Fix :** Tenter le batch parse en premier avant d'utiliser les combos stockés :
```javascript
// FIRST: tenter le batch parser — le client a peut-être re-spécifié avec variantes différentes
const batchAttempt = parseBatchCombinationLines(product, normalized)
if (batchAttempt.status === 'success') {
    // utiliser le résultat du batch, ignorer les partials stockés
}
```

---

### Bug 4 — "non" au CART_RECAP passait à une mauvaise réponse IA
**Fichier :** `src/lib/whatsapp/services/cart-state.service.js` — handler `CART_RECAP`
**Symptôme :** Le client répondait "non" pour signifier "pas d'autre article" → l'IA
répondait "dites-moi quel article à modifier" au lieu de passer au checkout.
**Fix :** Traiter la réponse négative comme la réponse positive (passer au CHECKOUT) :
```javascript
if (!productForNewLine && isNegativeReply(normalized)) {
    state.stage = CART_STAGE.CHECKOUT
    state.awaiting_field = null
    state.last_prompt_kind = CART_STAGE.CHECKOUT
    state.last_prompt_text = normalized
    return { state, capturedFields, stateChanged: true, shouldBypassAI: false, directReply: null }
}
```

---

### Bug 5 — Sélection catalogue "1" interprétée comme quantité=1
**Fichier :** `src/lib/whatsapp/services/cart-state.service.js` — bloc `!state.draft_item`
**Symptôme :** Après affichage du catalogue numéroté, si le client répond "1", le bot
détectait le produit n°1 ET extrayait quantity=1 depuis ce même chiffre, déclenchant une
demande de variante sans afficher les options du produit.
**Fix :** Retour immédiat si le message normalisé est un nombre pur :
```javascript
if (/^\d+$/.test(normalized.trim())) {
    return {
        state, capturedFields,
        stateChanged: true, shouldBypassAI: true,
        directReply: buildStructuredCartReply(state, products, []),
    }
}
```

---

### Bug 6 — `find_order` redemandait le numéro de téléphone au client
**Fichier :** `src/lib/whatsapp/ai/generator.js` — `hydrateToolCallArguments`
**Symptôme :** L'IA appelait `find_order` sans `phone_number`, puis demandait au client
son numéro alors qu'il était déjà connu via WhatsApp.
**Fix :** Injection automatique du `customerPhone` si absent des args :
```javascript
function hydrateToolCallArguments(toolCall, checkoutState, cartState, bookingState, customerPhone) {
    if (toolCall.function.name === 'find_order' && !parsedArgs.phone_number && customerPhone) {
        parsedArgs.phone_number = customerPhone
    }
    // ...
}
```

---

### Bug 7 — "vos 3 dernières commandes" même si 1 seule commande affichée
**Fichier :** `src/lib/whatsapp/ai/tools/tool-orders.js`
**Symptôme :** Le message de fin disait toujours "vos 3 dernières commandes" peu importe
le nombre réel retourné.
**Fix :** Calcul dynamique :
```javascript
const countLabel = orders.length === 1
    ? `votre dernière commande`
    : `vos ${orders.length} dernières commandes`
finalMessage += `\n\nℹ️ Ceci ${orders.length === 1 ? 'est' : 'sont'} ${countLabel}.`
```

---

### Bug 8 — L'IA commençait ses réponses par "Je note" ou "Je retiens"
**Fichier :** `src/lib/whatsapp/ai/prompt-builder.js` — section identité
**Symptôme :** L'IA confirmait les informations du client avec des formules administratives
comme "Je note votre commande", "Parfait, je retiens", créant une expérience froide et robotique.
**Fix :** Règle ajoutée dans le system prompt :
```
⛔ NE COMMENCE JAMAIS une réponse par "Je note", "Je retiens", "Parfait, je note" ou toute
formule administrative. Confirme naturellement et passe à la suite.
```

---

## Partie 2 — Refonte UX affichage produits

### Problème initial
Le bot affichait tous les combos bruts pour chaque produit → wall of text illisible sur
WhatsApp. Pour plusieurs produits simultanés, c'était encore pire.

### Solution : 3 niveaux d'affichage

Voir [`CART_MULTIPRODUCT_UX_2026-03-21.md`](./CART_MULTIPRODUCT_UX_2026-03-21.md) pour
la documentation complète.

**Résumé :**

| Niveau | Condition | Format |
|--------|-----------|--------|
| N1 | Prix uniforme | Header + liste variantes groupées |
| N2 | Prix par variante pivot | Une ligne par option pivot avec ses tailles dispo |
| N3 | Prix par combo individuel | Liste tronquée + overflow "plus [produit]" |

**Max combos N3 selon le nombre de produits affichés simultanément :**

| Nb produits | Max combos |
|-------------|------------|
| 1 | 8 |
| 2 | 6 |
| 3 | 4 |
| 4+ | 3 |

---

## Fichiers modifiés

| Fichier | Nature des changements |
|---------|------------------------|
| `src/lib/whatsapp/services/cart-state.service.js` | Refonte UX N1/N2/N3, multi-produits, 5 bugs |
| `src/lib/whatsapp/ai/generator.js` | Bug preCheck, injection phone `find_order` |
| `src/lib/whatsapp/ai/prompt-builder.js` | Règle anti "Je note" |
| `src/lib/whatsapp/ai/tools/tool-orders.js` | Compteur dynamique commandes |
| `supabase/migrations/20260319_fix_order_number_ambiguity.sql` | Fix SQL RETURNING ambiguity |

---

## Nouvelles fonctions dans `cart-state.service.js`

| Fonction | Rôle |
|----------|------|
| `detectPricingLevel(product)` | Classe le produit en N1, N2 ou N3 |
| `buildProductBlock(product, maxCombos)` | Génère le bloc texte formaté selon le niveau |
| `extractQuantityFromSegment(text)` | Extraction quantité intelligente (début ou fin de segment) |
| `detectMultipleProducts(text, products)` | Détecte ≥2 produits dans un message (seuil 15, hors services) |
| `buildMultiProductPrompt(products)` | Prompt ①②③ avec max combos dynamique |
| `parseMultiProductBatchLines(products, text)` | Parse "2 Robe Noire XL, 1 Veste Rose S" en lignes de panier |

---

## Nouveaux handlers dans `updateCartStateFromUserMessage`

| Handler | Déclencheur | Comportement |
|---------|-------------|--------------|
| "plus [produit]" | `normalized.match(/^plus\s+/)` + `awaiting_field.overflow` | Affiche les combos overflow N3 restants |
| `multi_product_combos` | `awaiting_field.type === 'multi_product_combos'` | Parse la réponse batch, accumule message par message dans `lines_collected` |
| Détection multi-produits | Avant `!state.draft_item`, panier vide | Déclenche le prompt ①②③ si ≥2 produits détectés |

---

## Parcours de validation

### Mono-produit N1
```
Client : t-shirt
Bot    : *T-Shirt Classic* — 5 000 FCFA
         Couleur : Blanc · Noir · Gris / Taille : S · M · L
         (ex : "2 Noire L et 1 Grise M")
Client : 2 noir l et 1 gris m
Bot    : Récap ✓
```

### Mono-produit N2
```
Client : robe
Bot    : *Robe de Soirée*
         · Noire : L · M · XL — 50 000 FCFA
         · Rouge : L · M · XL · XXL — 100 000 FCFA
         (ex : "2 Noire L et 1 Grise M")
Client : 2 noire l et 1 rouge xl
Bot    : Récap ✓
```

### Mono-produit N3 avec overflow
```
Client : veste
Bot    : *Veste Ajustée* — 40 000 à 90 000 FCFA
         · Noire / S — 40 000 FCFA ... (8 max)
         (+ 2 autres : tapez "plus veste")
Client : plus veste
Bot    : Combinaisons restantes : ...
Client : 2 noire s et 1 rose xxxl
Bot    : Récap ✓
```

### Multi-produits — tout en une ligne
```
Client : t-shirt, robe et veste
Bot    : ① *T-Shirt* ... ② *Robe* ... ③ *Veste* ...
         Précisez variante(s) + quantité pour chaque :
Client : 2 t-shirt noir l, 1 robe noire xl, 3 veste rose s
Bot    : Récap ✓
```

### Multi-produits — message par message
```
Client : t-shirt, robe et veste
Bot    : ① ② ③ prompt
Client : 2 t-shirt noir l
Bot    : Noté ! Il reste : Robe de Soirée, Veste Ajustée.
Client : 1 robe noire xl
Bot    : Noté ! Il reste : Veste Ajustée.
Client : 3 veste rose s
Bot    : Récap ✓
```

### Multi-produits — quantité en fin de segment
```
Client : t-shirt noir l 2, robe noire xl 1, veste rose s 3
Bot    : Récap ✓  (extractQuantityFromSegment prend le nombre en fin)
```

### Multi-produits — quantité absente (défaut = 1)
```
Client : t-shirt noir l, robe noire xl, veste rose s
Bot    : Récap ✓  (quantité = 1 pour chaque)
```
