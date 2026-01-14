# 🚀 GUIDE D'INTÉGRATION - Prompt Adaptatif

## 📋 PRÉAMBULE

Tu as maintenant **3 fichiers** :
1. ✅ **ARCHITECTURE_ANALYSIS.md** - Diagnostic complet
2. ✅ **prompt-builder-adaptive.js** - Nouveau système de prompt
3. ✅ **Ce guide** - Instructions d'intégration

---

## 🎯 OBJECTIF

Remplacer le prompt à "17 scénarios explicites" par un système **intelligent et adaptatif** qui peut gérer n'importe quelle situation.

---

## 🔧 INTÉGRATION DANS generator.js

### Étape 1 : Copier le fichier

```bash
# Depuis ton projet
cp /home/claude/prompt-builder-adaptive.js src/lib/whatsapp/ai/prompt-builder.js
```

### Étape 2 : Modifier generator.js

📁 **Fichier** : `src/lib/whatsapp/ai/generator.js`

#### 📍 Ligne 1 : Ajouter l'import

```javascript
// ❌ ANCIEN (ligne 1-3)
const { TOOLS, handleToolCall } = require('./tools')
const { findRelevantDocuments } = require('./rag')
const { verifyResponseIntegrity } = require('../utils/security')

// ✅ NOUVEAU (ajouter cette ligne après)
const { buildAdaptiveSystemPrompt } = require('./prompt-builder')
```

#### 📍 Ligne 50-250 : Remplacer la construction du prompt

```javascript
// ❌ ANCIEN (lignes 50-250 environ - tout le bloc de construction du prompt)
// Build products catalog 
let productsCatalog = ''
if (products && products.length > 0) {
    productsCatalog = `\n\nðŸ§  CONTEXTE PRODUITS & SERVICES :
    [... 200 lignes de code ...]`
}

const businessIdentity = `...`
let ordersContext = `...`
// [... encore 100 lignes ...]

const systemPrompt = `Tu es l'assistant IA de ${agent.name}...
[... tout le prompt manuel ...]`


// ✅ NOUVEAU (remplacer tout ça par)
const systemPrompt = buildAdaptiveSystemPrompt(
    agent,
    products || [],
    orders || [],
    relevantDocs || [],
    currency,
    gpsLink,
    formattedHours
)
```

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Produit Simple

```
Client : "Je veux un T-shirt"
✅ Attendu : Bot demande couleur/taille (si variantes)
✅ Attendu : Bot demande nom, téléphone, adresse
✅ Attendu : Bot propose mode paiement
✅ Attendu : Bot fait récap puis exécute create_order
```

### Test 2 : Service (Hôtel)

```
Client : "Je veux réserver une chambre"
✅ Attendu : Bot demande date
✅ Attendu : Bot demande nb personnes
✅ Attendu : Bot demande type chambre (si défini dans lead_fields)
✅ Attendu : Bot exécute create_booking
```

### Test 3 : Client Récurrent

```
Client : "Bonjour" (2ème visite)
✅ Attendu : "Rebonjour ! Besoin de la même chose ?"
   OU "Content de vous revoir !"
```

### Test 4 : Changement Avant Paiement

```
Client : "Je prends 2 T-shirts"
[Bot collecte infos]
Client : "Finalement, juste 1"
✅ Attendu : Bot accepte sans escalade
❌ Pas d'escalade : "Contactez le support"
```

### Test 5 : Modification Après Paiement

```
Client : "J'ai payé, je veux changer l'adresse"
✅ Attendu : Bot escalade vers support
✅ Attendu : Message avec numéro de contact
```

### Test 6 : Produit Indisponible

```
Client : "Vous avez des chaussures ?"
✅ Attendu : "Désolé, pas de chaussures. Mais nous avons..."
✅ Attendu : Propose 2-3 alternatives du catalogue
```

---

## 📊 MONITORING

### Métriques à Surveiller

1. **Taux de Complétion**
   ```javascript
   // Dans votre analytics
   conversationsCompleted / totalConversations
   Objectif : > 70%
   ```

2. **Taux d'Escalade**
   ```javascript
   escalatedConversations / totalConversations
   Objectif : < 10%
   ```

3. **Messages par Conversion**
   ```javascript
   averageMessages = totalMessages / completedOrders
   Objectif : < 12 messages
   ```

4. **Erreurs de Prix**
   ```javascript
   // Déjà géré par security.js
   priceHallucinations = 0
   Objectif : 0% (critique)
   ```

---

## 🔍 LOGS À AJOUTER (Optionnel mais Recommandé)

### Dans generator.js, après génération du prompt

```javascript
// Après : const systemPrompt = buildAdaptiveSystemPrompt(...)

// Debug log (enlever en production)
if (process.env.NODE_ENV === 'development') {
    console.log('📝 Prompt Tokens:', systemPrompt.length / 4) // Approximation
}
```

### Dans tools.js, dans handleToolCall

```javascript
// Au début de chaque tool
console.log('🔧 Tool appelé:', toolCall.function.name)
console.log('📊 Args:', JSON.parse(toolCall.function.arguments))
```

---

## ⚠️ POINTS D'ATTENTION

### 1. Compatibilité avec message.js

Le fichier `message.js` (CommonJS) appelle `generator.js`.
✅ Pas de problème : On modifie juste generator.js
✅ L'interface reste identique

### 2. Compatibilité avec openai.ts

⚠️ **ATTENTION** : openai.ts a son propre prompt (différent)

**Choix à faire** :

**Option A** : Laisser comme ça (2 systèmes)
- message.js → generator.js → prompt adaptatif ✅
- message-handler.ts → openai.ts → ancien prompt ⚠️

**Option B** : Unifier aussi openai.ts
- Créer une version TypeScript de prompt-builder.js
- Modifier openai.ts pour l'utiliser
- Temps : +1 jour

**Recommandation** : Option A pour l'instant
Raison : generator.js est le système principal (service standalone)

---

## 🐛 DÉPANNAGE

### Problème 1 : "buildAdaptiveSystemPrompt is not a function"

**Cause** : Import mal fait

**Solution** :
```javascript
// Vérifier dans generator.js ligne ~5
const { buildAdaptiveSystemPrompt } = require('./prompt-builder')

// Et vérifier que prompt-builder.js exporte bien
module.exports = { buildAdaptiveSystemPrompt }
```

### Problème 2 : Prompt trop long (>2000 tokens)

**Cause** : Trop de produits ou historique

**Solution** :
```javascript
// Dans generator.js, limiter les données
const limitedProducts = (products || []).slice(0, 20) // Max 20 produits
const limitedOrders = (orders || []).slice(0, 3)      // Max 3 commandes
```

### Problème 3 : Bot ne détecte pas les confirmations

**Cause** : Mots-clés non reconnus

**Solution** : Ajouter dans Principe 4 (prompt-builder.js)
```javascript
ATTENDS CONFIRMATION :
Mots-clés : "Oui", "OK", "D'accord", "C'est bon", "Valide", "Go", "Parfait"
```

---

## 📈 ÉVOLUTION FUTURE

### Phase 1 : Stabilisation (Semaine 1)
- [ ] Déployer sur 1 agent test
- [ ] Surveiller métriques
- [ ] Corriger bugs
- [ ] Documenter edge cases

### Phase 2 : Optimisation (Semaine 2)
- [ ] Analyser conversations longues
- [ ] Identifier patterns récurrents
- [ ] Ajuster principes si besoin
- [ ] Ajouter exemples dans prompt

### Phase 3 : Extension (Semaine 3+)
- [ ] Unifier avec openai.ts
- [ ] Migrer tools.js → TypeScript
- [ ] Créer tests automatisés
- [ ] Documentation API complète

---

## 🎓 FORMATION ÉQUIPE

### Pour les Développeurs

**Avant** :
- "Je dois ajouter un scénario dans generator.js"
- Éditer 50 lignes de prompt

**Maintenant** :
- "Le bot devrait gérer ça automatiquement"
- Si besoin, ajuster un PRINCIPE (pas un scénario)

### Pour le Business

**Avant** :
- "On a oublié le scénario X"
- Attendre dev pour l'ajouter

**Maintenant** :
- Bot s'adapte automatiquement
- Sauf cas vraiment exotiques

---

## ✅ CHECKLIST FINALE

Avant de déployer en production :

- [ ] ✅ Backup de generator.js original
- [ ] ✅ prompt-builder.js copié dans le projet
- [ ] ✅ Import ajouté dans generator.js
- [ ] ✅ Construction prompt remplacée
- [ ] ✅ Tests manuels (6 scénarios minimum)
- [ ] ✅ Test sur agent staging
- [ ] ✅ Vérification logs (pas d'erreurs)
- [ ] ✅ Surveillance 24h sur staging
- [ ] ✅ Déploiement progressif (10% → 50% → 100%)
- [ ] ✅ Monitoring continu 1 semaine

---

## 🆘 SUPPORT

Si problème :
1. Check logs : `pm2 logs whatsapp-service`
2. Vérifier imports dans generator.js
3. Tester avec un seul agent
4. Rollback si critique (restaurer generator.js original)

**Contact** : [Ton email/Slack]

---

## 🎉 RÉSULTAT ATTENDU

**Avant** :
- Prompt : 500 lignes de scénarios
- Maintenance : Difficile
- Adaptabilité : Limitée

**Après** :
- Prompt : 300 lignes de principes
- Maintenance : Facile (ajuster principes)
- Adaptabilité : Maximale (gère situations imprévues)

---

**🚀 Tu es prêt ! Bonne intégration !**
