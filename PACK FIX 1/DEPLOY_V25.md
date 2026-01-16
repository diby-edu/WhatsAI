# 🚀 DÉPLOIEMENT v2.5 - Fix Combiné (Meilleur des 2 analyses)

## 📋 Ce qui change en v2.5

### Basé sur l'analyse de l'autre expert :
1. ✅ **Variantes EN PREMIER** dans le prompt (pas au milieu)
2. ✅ **Prompt plus court** = meilleure rétention par GPT
3. ✅ **Logs de debug** pour voir exactement ce que l'IA envoie

### Basé sur mon analyse :
4. ✅ **Pre-check** qui bloque si `selected_variants` manquant
5. ✅ **Messages d'erreur explicites** pour guider l'IA

---

## 📁 FICHIERS À DÉPLOYER

### 1. `prompt-builder-v25.js` → `src/lib/whatsapp/ai/prompt-builder.js`

**Structure du nouveau prompt :**
```
1. 🚨 RÈGLE ABSOLUE VARIANTES (EN PREMIER !)
2. Identité courte
3. Catalogue (avec rappels variantes)
4. Ordre de collecte
5. Autres règles (condensées)
6. Outils
7. Historique client
```

### 2. `generator-v25.js` → `src/lib/whatsapp/ai/generator.js`

**Nouveaux logs de debug :**
```
═══════════════════════════════════════════════
🔍 DEBUG create_order - Arguments reçus de l'IA :
{
  "items": [{
    "product_name": "T-Shirt Premium",
    "quantity": 10,
    "selected_variants": { ... }  ← On verra si c'est présent !
  }]
}
═══════════════════════════════════════════════
```

---

## 📝 COMMANDES DE DÉPLOIEMENT

```bash
# 1. Connexion
ssh root@votre-serveur
cd /root/WhatsAI

# 2. Backup
cp src/lib/whatsapp/ai/prompt-builder.js src/lib/whatsapp/ai/prompt-builder.js.v24
cp src/lib/whatsapp/ai/generator.js src/lib/whatsapp/ai/generator.js.v24

# 3. Éditer prompt-builder.js
nano src/lib/whatsapp/ai/prompt-builder.js
# → Coller le contenu de prompt-builder-v25.js
# → Ctrl+O, Enter, Ctrl+X

# 4. Éditer generator.js  
nano src/lib/whatsapp/ai/generator.js
# → Coller le contenu de generator-v25.js
# → Ctrl+O, Enter, Ctrl+X

# 5. Redémarrer
pm2 restart whatsai-bot

# 6. Surveiller les logs
pm2 logs whatsai-bot --lines 100
```

---

## 🧪 TEST & INTERPRÉTATION DES LOGS

### Scénario de test :
1. Client : "Je veux 10 t-shirts"
2. Bot demande taille
3. Client : "Moyenne"
4. Bot demande couleur
5. Client : "Bleu Marine"
6. Bot demande nom, tél, adresse
7. Bot crée la commande

### Ce que tu dois voir dans les logs :

**✅ SI ÇA MARCHE :**
```
🔍 DEBUG create_order - Arguments reçus de l'IA :
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
  ...
}
   ✅ Taille: "Moyenne"
   ✅ Couleur: "Bleu Marine"
✅ PRE-CHECK PASSED
✅ Order created: abc-123
```

**❌ SI LE BUG PERSISTE :**
```
🔍 DEBUG create_order - Arguments reçus de l'IA :
{
  "items": [{
    "product_name": "T-Shirt Premium en coton bio",
    "quantity": 10
    // ← PAS DE selected_variants !
  }]
}
   selected_variants: ❌ NON FOURNI
   ❌ VARIANTE MANQUANTE: "Couleur"
🚫 PRE-CHECK BLOCKED
```

Si tu vois "❌ NON FOURNI", ça confirme que l'IA ignore toujours les instructions.
Le pre-check bloquera l'appel et forcera l'IA à reformuler.

---

## 🔧 SI LE BUG PERSISTE APRÈS v2.5

### Option A : Passer à GPT-4 (plus intelligent)
Dans la config de l'agent, changer le modèle de `gpt-4o-mini` à `gpt-4o`.
GPT-4 suit mieux les instructions complexes.

### Option B : Forcer selected_variants dans le schema
Modifier `tools.js` pour rendre `selected_variants` **required** :

```javascript
items: {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            product_name: { type: 'string' },
            quantity: { type: 'integer' },
            selected_variants: { type: 'object' }
        },
        required: ['product_name', 'quantity', 'selected_variants']  // ← Ajouter ici
    }
}
```

⚠️ Attention : Cela forcera TOUS les produits à avoir selected_variants, même ceux sans variantes.

### Option C : Simplifier les variantes
Si le produit a trop de variantes, l'IA se perd. 
Limite à 2 variantes max par produit (ex: Taille + Couleur).

---

## 📊 Comparaison v2.4 vs v2.5

| Aspect | v2.4 | v2.5 |
|--------|------|------|
| Position variantes dans prompt | Début (mais long) | **TOUT DÉBUT (court)** |
| Taille du prompt | ~4000 chars | ~2000 chars |
| Logs debug | Basiques | **Détaillés** |
| Pre-check | ✅ Oui | ✅ Oui (amélioré) |

La v2.5 combine le meilleur des deux analyses ! 🎯
