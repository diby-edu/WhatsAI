# 🏗️ ARCHITECTURE RÉELLE DU PROJET WhatsAI

## 📊 DÉCOUVERTE CRITIQUE

### ⚠️ DOUBLE IMPLÉMENTATION DÉTECTÉE !

Il existe **DEUX systèmes parallèles** dans ton projet :

```
┌─────────────────────────────────────────────────────────┐
│                   🌐 Next.js App                         │
│                                                          │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  SYSTÈME A           │    │  SYSTÈME B           │  │
│  │  (TypeScript)        │    │  (JavaScript)        │  │
│  │                      │    │                      │  │
│  │  message-handler.ts  │    │  message.js          │  │
│  │        ↓             │    │        ↓             │  │
│  │  openai.ts           │    │  generator.js        │  │
│  │  (Prompt simple)     │    │  (Prompt complexe)   │  │
│  │                      │    │                      │  │
│  │  Tools: Basique      │    │  tools.js (30KB)     │  │
│  │  create_booking      │    │  + send_image        │  │
│  │  create_order        │    │  + check_payment     │  │
│  └──────────────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 ANALYSE FICHIER PAR FICHIER

### 1️⃣ SYSTÈME A - TypeScript (Playground Web)

**📁 message-handler.ts** (458 lignes)
- ✅ Gère les messages WhatsApp entrants
- ✅ Transcription audio (Whisper)
- ✅ Vision AI (images)
- ✅ Gestion crédits
- ⚠️ Appelle `generateAIResponse` de **openai.ts**

**📁 openai.ts** (536 lignes)
- ✅ Interface propre avec OpenAI API
- ⚠️ **Prompt SIMPLIFIÉ** (~200 lignes de règles)
- ✅ Gestion des tools (create_booking, create_order)
- ❌ **PAS de gestion des scénarios avancés**
- ❌ **PAS de send_image, check_payment_status**
- ❌ **PAS de gestion de l'historique client**

**Utilisation** : API web `/api/whatsapp/connect`

---

### 2️⃣ SYSTÈME B - JavaScript (Service Standalone)

**📁 message.js** (14KB)
- ✅ Gère messages WhatsApp (via Baileys)
- ✅ Sentiment analysis (escalade si colère)
- ✅ Transcription audio
- ✅ Gestion images
- ✅ Envoi vocal (TTS)
- ⚠️ Appelle `generateAIResponse` de **generator.js**

**📁 generator.js** (26KB - 491 lignes) 🎯
- ✅ **PROMPT ULTRA-COMPLET** (~400 lignes)
- ✅ Gestion de l'historique client
- ✅ Réutilisation intelligente
- ✅ 17 scénarios explicites
- ✅ Anti-hallucination (verification prix)
- ✅ RAG (knowledge base)

**📁 tools.js** (30KB)
- ✅ create_order (gestion variantes, matching fuzzy)
- ✅ create_booking
- ✅ check_payment_status
- ✅ send_image (avec compression Sharp)

**Utilisation** : Service Node.js standalone (PM2)

---

## ⚠️ PROBLÈMES IDENTIFIÉS

### 🔴 Critique

1. **DUPLICATION DE CODE**
   - `openai.ts` vs `generator.js` (logique différente)
   - `cinetpay.ts` vs `cinetpay.js`
   - Maintenance nightmare

2. **PROMPTS DÉSYNCHRONISÉS**
   - openai.ts : ~200 lignes (simple)
   - generator.js : ~400 lignes (complet)
   - ❌ Comportement différent selon le point d'entrée

3. **CONFUSION ROUTING**
   - Quand utilise-t-on message-handler.ts ?
   - Quand utilise-t-on message.js ?
   - Pas de documentation

### 🟡 Moyen

4. **TOOLS INCOMPLETS (openai.ts)**
   - Manque send_image
   - Manque check_payment_status
   - Moins de fonctionnalités que tools.js

5. **HISTORIQUE CLIENT**
   - generator.js : ✅ Gère réutilisation infos
   - openai.ts : ❌ Ne le fait pas

---

## 🎯 RECOMMANDATIONS

### Option 1️⃣ : UNIFICATION (Recommandé ⭐)

**Objectif** : Un seul prompt système adaptatif

```
📁 Nouvelle structure :
src/lib/ai/
  ├── prompt-builder.ts     ← NOUVEAU (logique unifiée)
  ├── openai-client.ts      ← Garde API calls
  └── tools/
      ├── order.ts          ← Unifié (TS)
      ├── booking.ts
      ├── image.ts
      └── payment-check.ts

Supprimer :
  ❌ generator.js (fusionner dans prompt-builder.ts)
  ❌ Duplication cinetpay
```

---

## 📋 PLAN D'ACTION RECOMMANDÉ

### Phase 1 : Audit & Documentation (1 jour)
- [ ] Documenter quand chaque système est utilisé
- [ ] Identifier les différences de comportement
- [ ] Lister les bugs/limitations actuels

### Phase 2 : Prototype Unifié (2 jours)
- [ ] Créer `prompt-builder.ts` avec approche adaptative
- [ ] Migrer generator.js → prompt-builder.ts
- [ ] Tests sur agent test

### Phase 3 : Unification Tools (1 jour)
- [ ] Migrer tools.js → TypeScript modules
- [ ] Supprimer duplications

### Phase 4 : Tests & Déploiement (2 jours)
- [ ] Tests de régression (20 scénarios)
- [ ] Déploiement progressif (10% → 50% → 100%)
- [ ] Monitoring intensif

**Total** : ~6 jours pour unification complète

---

## 💡 SOLUTION IMMÉDIATE (Si pas le temps)

**Améliorer generator.js SEULEMENT** avec approche adaptative :

```javascript
// Dans generator.js
const systemPrompt = buildAdaptivePrompt({
    agent,
    products,
    orders,
    businessInfo,
    relevantDocs
})
```

**Temps** : 1-2 jours
**Risque** : Faible
**Impact** : Gros (meilleure adaptabilité)
