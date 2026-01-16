# 🔍 AUDIT COMPLET - WhatsAI Bot v2.6
## Rapport d'Inspection Systématique

Date: Janvier 2026
Auteur: Audit Expert

---

## 📋 RÉSUMÉ EXÉCUTIF

Après inspection complète du code, j'ai identifié **7 problèmes** dont **3 critiques** et **4 mineurs**.

### Problèmes Critiques (Bloquants)
| # | Fichier | Problème | Impact |
|---|---------|----------|--------|
| 1 | `tools.js` | Matching strict des options de variantes | Boucle infinie |
| 2 | `generator.js` | Pre-check incomplet (ne valide pas les options) | Faux positifs |
| 3 | `prompt-builder.js` | Options affichées avec suffixes, IA envoie sans | Mismatch |

### Problèmes Mineurs (Non-bloquants)
| # | Fichier | Problème | Impact |
|---|---------|----------|--------|
| 4 | `tools.js` | Pas de log si produit sans variantes | Debug difficile |
| 5 | `generator.js` | Hallucination prix détectée mais non bloquée | UX dégradée |
| 6 | `prompt-builder.js` | Catalogue montre prix "0 FCFA" | Confusion client |
| 7 | `message.js` | Pas de retry sur erreur OpenAI | Messages perdus |

---

## 🔴 PROBLÈME CRITIQUE #1 : Matching Strict des Variantes

### Localisation
`src/lib/whatsapp/ai/tools.js` - fonction `handleToolCall`

### Description
Le code v2.5 faisait une comparaison **stricte** :
```javascript
// ANCIEN CODE (v2.5)
optValue.toLowerCase() === selectedValue.toLowerCase()
// "petite (50g)" === "petite" → FALSE ❌
```

L'IA envoie `"Petite"` mais la BDD contient `"Petite (50g)"`.

### Solution (v2.6)
Matching flexible avec `findMatchingOption()` :
```javascript
// NOUVEAU CODE (v2.6)
optValueLower.startsWith(selectedLower) ||
selectedLower.startsWith(optValueLower) ||
optValueLower.includes(selectedLower)
```

### Statut
✅ **CORRIGÉ dans v2.6** - Mais non déployé sur le serveur

---

## 🔴 PROBLÈME CRITIQUE #2 : Pre-Check Incomplet

### Localisation
`src/lib/whatsapp/ai/generator.js` - fonction `preCheckCreateOrder`

### Description
Le pre-check vérifie si la **clé** existe dans `selected_variants`, mais pas si la **valeur** est valide :
```javascript
// Pre-check dit OK si "Taille" existe
const hasVariant = Object.keys(selectedVariants).some(
    k => k.toLowerCase() === variantNameLower
)
// Mais ne vérifie pas si "Petite" matche "Petite (50g)"
```

Résultat : Pre-check passe ✅ mais le tool échoue ❌

### Solution
Le pre-check doit utiliser la même logique `findMatchingOption()` que le tool :
```javascript
// Importer la fonction depuis tools.js
const { findMatchingOption } = require('./tools')

// Dans preCheckCreateOrder :
const validOption = findMatchingOption(variant, selectedValue)
if (!validOption) {
    return { valid: false, error: `Option "${selectedValue}" invalide pour ${variant.name}` }
}
```

### Statut
❌ **NON CORRIGÉ** - À corriger

---

## 🔴 PROBLÈME CRITIQUE #3 : Mismatch Options Catalogue/IA

### Localisation
`src/lib/whatsapp/ai/prompt-builder.js` - fonction `buildCatalogueSection`

### Description
Le catalogue affiche les options **complètes** :
```
VARIANTES: Taille: [Petite (50g), Moyenne (100g), Grande (200g)]
```

Mais l'IA envoie souvent le **nom court** :
```json
"selected_variants": { "Taille": "Petite" }
```

### Solution
Option A : Afficher les options **sans suffixes** dans le prompt
Option B : Instruire l'IA d'envoyer le nom **exact** du catalogue
Option C : (Actuel) Matching flexible côté tools.js ✅

### Statut
✅ **CONTOURNÉ par v2.6** - Le matching flexible résout le symptôme

---

## 🟡 PROBLÈME MINEUR #4 : Logs Manquants

### Localisation
`src/lib/whatsapp/ai/tools.js`

### Description
Quand un produit n'a PAS de variantes, aucun log n'est émis. Rend le debug difficile.

### Solution
Ajouter :
```javascript
if (!product.variants || product.variants.length === 0) {
    console.log(`   ℹ️ Produit "${product.name}" sans variantes`)
}
```

### Statut
❌ **NON CORRIGÉ** - Mineur

---

## 🟡 PROBLÈME MINEUR #5 : Hallucination Prix Non Bloquée

### Localisation
`src/lib/whatsapp/ai/generator.js` - ligne ~180

### Description
Le système détecte les hallucinations de prix mais les laisse passer :
```javascript
const integrityCheck = verifyResponseIntegrity(content, products)
if (!integrityCheck.isValid) {
    console.log('⚠️ Response integrity issues:', integrityCheck.issues)
    // Mais on continue quand même...
}
```

### Solution Recommandée
Option A (Soft) : Ajouter un avertissement dans la réponse
Option B (Hard) : Régénérer la réponse si hallucination détectée
Option C (Pragmatique) : Logger pour monitoring, alerter si fréquent

### Statut
❌ **NON CORRIGÉ** - À discuter

---

## 🟡 PROBLÈME MINEUR #6 : Prix "0 FCFA" Affiché

### Localisation
`src/lib/whatsapp/ai/prompt-builder.js` - ligne ~130

### Description
Si un produit avec variantes a `price_fcfa = 0` (prix de base), le catalogue affiche :
```
T-Shirt Premium - 0 FCFA
```

Ce qui est confus car le vrai prix dépend de la variante choisie.

### Solution
```javascript
let priceDisplay = p.price_fcfa && p.price_fcfa > 0
    ? `${p.price_fcfa.toLocaleString()} FCFA`
    : (p.variants?.length > 0 ? 'Prix selon variante' : 'Gratuit')
```

### Statut
❌ **NON CORRIGÉ** - Mineur

---

## 🟡 PROBLÈME MINEUR #7 : Pas de Retry OpenAI

### Localisation
`src/lib/whatsapp/ai/generator.js` - catch block

### Description
Si OpenAI échoue (timeout, rate limit), le message est perdu :
```javascript
} catch (error) {
    console.error('OpenAI error:', error)
    return { content: 'Désolé, problème technique...', tokensUsed: 0 }
}
```

### Solution
Ajouter retry avec backoff exponentiel :
```javascript
const MAX_RETRIES = 3
for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
        const completion = await openai.chat.completions.create(...)
        break // Succès
    } catch (error) {
        if (attempt === MAX_RETRIES) throw error
        await sleep(1000 * attempt) // Backoff
    }
}
```

### Statut
❌ **NON CORRIGÉ** - Mineur mais recommandé

---

## 📦 FICHIER CONSOLIDÉ : tools-v2.7.js

Ce fichier corrige les problèmes #1, #4 et exporte `findMatchingOption` pour le pre-check.

## 📦 FICHIER CONSOLIDÉ : generator-v2.7.js

Ce fichier corrige les problèmes #2 et #7.

## 📦 FICHIER CONSOLIDÉ : prompt-builder-v2.7.js

Ce fichier corrige le problème #6.

---

## 🚀 PLAN DE DÉPLOIEMENT

### Étape 1 : Déployer tools-v2.7.js (CRITIQUE)
```bash
cp tools-v2.7.js src/lib/whatsapp/ai/tools.js
```

### Étape 2 : Déployer generator-v2.7.js (CRITIQUE)
```bash
cp generator-v2.7.js src/lib/whatsapp/ai/generator.js
```

### Étape 3 : Déployer prompt-builder-v2.7.js (OPTIONNEL)
```bash
cp prompt-builder-v2.7.js src/lib/whatsapp/ai/prompt-builder.js
```

### Étape 4 : Redémarrer
```bash
pm2 restart whatsai-bot
pm2 logs whatsai-bot --lines 100
```

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Commande Simple (Sans Variantes)
```
Client: "Je veux 5 Microsoft Office"
Attendu: Commande créée sans erreur de variantes
```

### Test 2 : Commande avec Variantes (Noms Courts)
```
Client: "Je veux 10 bougies petites"
Attendu: Match "Petite" → "Petite (50g)", commande créée
```

### Test 3 : Commande Multi-Produits
```
Client: "Je veux 5 office, 10 bougies moyennes, 20 t-shirts or premium"
Attendu: Toutes les variantes matchées, commande créée
```

### Test 4 : Variante Invalide
```
Client: "Je veux des bougies taille XXL"
Attendu: "Cette taille n'existe pas. Choisissez: Petite, Moyenne, Grande"
```

---

## 📊 MÉTRIQUES DE SUCCÈS

Après déploiement, surveiller pendant 24h :

| Métrique | Seuil Acceptable |
|----------|------------------|
| Taux de "Missing variant" | < 5% des commandes |
| Taux d'hallucination prix | < 10% des messages |
| Boucles infinies | 0 |
| Commandes créées avec succès | > 90% |

---

## 🔮 RECOMMANDATIONS FUTURES

1. **Tests Unitaires** : Ajouter des tests pour `findMatchingOption()`
2. **Monitoring** : Dashboard Supabase pour tracker les erreurs
3. **Fallback GPT-4** : Si GPT-4o-mini échoue 3x, switch vers GPT-4
4. **Cache Produits** : Éviter requêtes BDD répétitives
5. **Queue Messages** : Redis pour gérer la charge

---

Fin du rapport d'audit.
