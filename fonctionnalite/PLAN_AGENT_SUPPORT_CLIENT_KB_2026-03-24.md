# Plan d'Implémentation — Agent Support Client & Base de Connaissance

**Date :** 2026-03-24
**Statut :** Validé — révisé après audit experts Antigravity, Codex (v4)

---

## Contexte

Permettre à un agent IA de fonctionner en mode **Support Client** (sans produits, uniquement via base de connaissance) en plus du mode transactionnel existant.

Cas d'usage déclencheur : Mr. LIBAN HOUSSEIN AHMED (formateur cybersécurité) — agent informatif qui répond aux questions sur ses formations via un FAQ chargé en KB.

---

## Principes validés

- L'agent **Support Client** répond UNIQUEMENT depuis la base de connaissance
- Jamais inventer une information absente de la KB
- Si info absente → renvoyer vers le **numéro d'escalade** de façon naturelle et humaine (jamais dire "je suis un bot")
- **Le comportement se déduit automatiquement du contenu** (pas de champ `agent_type` en DB) :
  - Pas de produits + KB → Support Client automatique
  - Produits sans KB → Transactionnel pur
  - Produits + KB → Hybride (transactionnel + KB injectée)
- **`hasKnowledgeBase` = COUNT serveur**, pas `relevantDocs.length` (RAG peut retourner 0 docs sur "Bonjour")
- **Paiement Support Client** : moyens manuels configurés dans le wizard → injectés dans le prompt → l'agent les cite. Pas de CinetPay, pas de commande créée.

---

## Phase 0 — Prérequis bloquants (avant tout)

### 0.1 — Bug critique : API POST agents ne persiste pas les champs paiement/escalade
Fichier : `src/app/api/agents/route.ts` (POST uniquement)

Les champs suivants sont envoyés par le wizard mais **non insérés en DB à la création** :
- `payment_mode`
- `mobile_money_orange`, `mobile_money_mtn`, `mobile_money_wave`
- `custom_payment_methods`
- `escalation_phone`

→ Ajouter ces champs dans le `.insert({...})` de la route POST.
→ La route PATCH (`src/app/api/agents/[id]/route.ts:87`) accepte déjà ces champs — vérifier uniquement si le schéma prod est incomplet, pas de correction systématique.

### 0.2 — Bug critique : schéma `custom_payment_methods` incohérent
- UI wizard sauvegarde : `{ name: string, details: string }`
- `prompt-builder.js:151` lit : `m.number` → **`undefined` partout**
- `tool-orders.js:323` lit aussi `m.number`

→ Choisir un standard unique : `{ name, details }` (aligné sur l'UI)
→ Corriger `prompt-builder.js` et `tool-orders.js` pour lire `m.details` au lieu de `m.number`.

---

## Phase 1 — Fondations RAG

### 1.1 — Audit `match_documents` (pas une création)
La fonction existe déjà : `supabase/migrations/20260115_fix_rag_security.sql`
- Vérifier qu'elle est bien exécutée en production (pas seulement dans les fichiers de migration)
- L'ancienne version sans `p_agent_id` existe dans `enable_vector_store.sql` — vérifier qu'elle est remplacée
- Si déjà en prod → phase 1.1 = done. Sinon → exécuter la migration sécurisée.

### 1.2 — Corriger le blocage "catalogue vide"
Fichiers : `src/lib/whatsapp/ai/prompt-builder.js` + `workflow-generic.js:13`

**Ajouter `hasKnowledgeBase` comme paramètre** — calculé côté serveur (COUNT des documents KB de l'agent), pas déduit de `relevantDocs`.

**Où le calculer** : dans `src/lib/whatsapp/handlers/message.js`, avant l'appel au générateur IA. Le handler charge déjà l'agent et a accès à Supabase — c'est le meilleur endroit pour faire le COUNT et passer `hasKnowledgeBase` en contexte. `generator.js` le reçoit ensuite et le transmet à `prompt-builder.js`.

Nouvelle logique :

| Produits | KB | Comportement |
|---|---|---|
| ❌ | ❌ | Message "aucun produit configuré" (actuel) |
| ❌ | ✅ | Prompt Support Client (KB only) |
| ✅ | ❌ | Agent transactionnel pur (actuel) |
| ✅ | ✅ | Agent transactionnel + KB injectée |

### 1.3 — Rendre la Base de Connaissance accessible
- Ajouter un lien/onglet vers `/dashboard/agents/[id]/knowledge` depuis la page agent
- Accessible pour TOUS les types d'agents
- **Sécurité** : vérifier que `/api/knowledge` POST valide que `agentId` appartient bien à l'utilisateur connecté (actuellement non vérifié)

---

## Phase 2 — Agent Support Client

### 2.1 — Déplacer la Mission à l'étape 0 du wizard
**Décision ferme** : le choix de la mission doit être la **première étape** du wizard (étape 0), avant Identité, Horaires, Paiement, etc.

Pourquoi : c'est la seule façon de masquer dynamiquement les étapes suivantes selon la mission choisie.

**Concerne les 2 écrans** :
- Création : `src/app/[locale]/dashboard/agents/new/page.tsx:115`
- Édition : `src/app/[locale]/dashboard/agents/[id]/page.tsx:34` — actuellement "mission" = textarea libre à l'étape 640. Doit devenir cohérent avec le wizard de création.

**Nouveau wizard :**
```
Étape 0 : Choisir la mission
  → E-commerce / Boutique
  → Restaurant / Fast-food
  → Hôtel / Hébergement
  → Salon / Beauté
  → Services / Artisan
  → Support Client  ← NOUVEAU
  → Personnalisé

Étape 1 : Identité & Prix        (toutes missions)
Étape 2 : Horaires               (masqué si Support Client)
Étape 3 : Paiement               (mode manuel si Support Client, CinetPay masqué)
Étape 4 : Personnalité & Règles  (toutes missions)
Étape 5 : WhatsApp               (toutes missions)
```

Les autres missions restent **inchangées**.

### 2.2 — Migration SQL : champs agent
```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_context TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS escalation_phone TEXT;
```
> `escalation_phone` est déjà utilisé en runtime (`message.js:428`). Ces colonnes sont présentées comme un **alignement de schéma si manquant**, pas comme un fait certain d'absence.
> Pas de champ `agent_type` — le mode est déduit dynamiquement.

### 2.3 — Prompt Support Client
Fichiers : `src/lib/whatsapp/ai/prompt-builder.js` + `src/lib/whatsapp/ai/generator.js:318`

Condition : `products.length === 0 && hasKnowledgeBase === true`

- Remplacer tout le bloc catalogue/vente par le prompt KB-only
- **Désactiver les tools transactionnels** dans `generator.js` (pas seulement dans le prompt) :
  - `create_order` → désactivé
  - `create_booking` → désactivé
  - `send_image` → désactivé
  - `find_order` → désactivé (pas de commandes en mode Support Client)
  - `check_payment_status` → désactivé (pas de paiement CinetPay en mode Support Client)
- Règles absolues injectées :
  1. Répondre UNIQUEMENT depuis la base de connaissance
  2. Ne jamais inventer ni supposer
  3. Si info absente → renvoyer vers `escalation_phone` de façon naturelle et humaine
- Injecter `agent.agent_context` comme instructions supplémentaires
- Injecter `agent.escalation_phone` dans la phrase de renvoi
- **Corriger la règle de paiement** : supprimer "NE PAS lister les numéros" pour le mode Support Client — l'agent doit citer ouvertement Waaffi/CacBank quand le client demande comment payer
- Injecter les moyens de paiement manuels configurés (après fix 0.2)

---

## Phase 3 — Import KB amélioré

> Le chunking est une **fondation**, pas un confort. Sans modèle source + chunks, le chunking cassera l'UI KB actuelle.

### 3.1 — Modèle source + chunks (prérequis au chunking)
Problème actuel : 1 ligne DB = 1 document = 1 carte UI. Si 1 document devient 20 chunks → 20 cartes, suppression fragmentée.

Solution : ajouter `source_id` / `chunk_index` dans la table `knowledge_base`, ou créer une table `knowledge_sources`.

Fichiers impactés :
- `src/app/api/knowledge/route.ts` (liste, création)
- `src/app/api/knowledge/[id]/route.ts` (suppression par source, pas par chunk)
- `src/app/[locale]/dashboard/agents/[id]/knowledge/page.tsx` (UI affiche sources, pas chunks)
- `src/types/database.ts` : ajouter `source_id` et `chunk_index` dans `knowledge_base.Row` et `knowledge_base.Insert` — sans ça, TypeScript rejettera les nouveaux champs partout

### 3.2 — Chunking de l'ingestion KB
Après 3.1 : découper le texte en blocs de ~500 tokens avant génération des embeddings. Un document source = N chunks vectorisés.

### 3.3 — Import PDF
Upload fichier PDF → extraction texte → chunking → documents KB

### 3.4 — Import URL
Saisir une URL (page web ou fichier) → fetch contenu → extraction → chunking → documents KB
Couvre : Google Drive, sites web, fichiers hébergés

---

## Phase 4 — Agent Formation / Inscription (Option B)

> Permet à Mr. LIBAN (et tout formateur) de recevoir des inscriptions et suivre les paiements dans le dashboard.
> ⚠️ Phase plus large qu'estimée initialement.

### 4.1 — Décision architecture inscription (AVANT le code)
Choisir entre :
- **Order spécialisé** : inscription = commande avec `payment_method = 'mobile_money_direct'` (déjà connu du dashboard `orders/page.tsx:162`), nouveau statut "inscription_pending" à ajouter dans `src/app/api/orders/[id]/status/route.ts`
- **Booking enrichi** : modifier le flow booking pour supporter "inscription en attente" sans date/heure obligatoire

> `payment_method = 'manual'` n'existe pas dans la stack (`definitions.js:46` n'accepte que `online|cod`). Utiliser `mobile_money_direct`.
> Si "order spécialisé" retenu : **étendre `definitions.js`** pour ajouter `mobile_money_direct` dans l'enum `payment_method` du tool `create_order`, sinon l'IA ne pourra jamais créer une inscription.

### 4.2 — Moteur INSCRIPTION
Après décision 4.1 :
- `Formation / Atelier` existe déjà dans `service_subtype` (SQL + UI produit) ✅
- Ajouter `'formation': 'INSCRIPTION'` dans `SERVICE_ENGINE_MAP` de `prompt-builder.js`
- Créer `workflow-service-inscription.js` (distinct du moteur `SLOT`) :
  1. Présenter la formation (dates, durée, prix, prérequis)
  2. "Souhaitez-vous vous inscrire ?"
  3. Capture : Nom + Téléphone
  4. Envoi coordonnées de paiement manuel
  5. Créer une inscription selon l'architecture choisie en 4.1

### 4.3 — Dashboard : suivi des inscriptions
- Les inscriptions apparaissent dans `/dashboard/orders` avec statut "inscription en attente"
- Pas de lien CinetPay (paiement manuel géré par le formateur)

---

## Ce qui ne change pas

- Flow transactionnel (panier, checkout, commandes) — **intact**
- Agents existants — comportement inchangé (ont des produits → mode transactionnel automatique)
- Base de connaissance existante — **compatible**
- Tests prompt-builder (22/22 passent) — toute modification doit maintenir ce coverage

---

## Ordre de priorité révisé

| Priorité | Phase | Tâche |
|---|---|---|
| 🔴 Critique | 0.1 | API POST agents : persister payment_mode, escalation_phone (POST only) |
| 🔴 Critique | 0.2 | Normaliser custom_payment_methods → `{ name, details }` partout |
| 🔴 Critique | 1.1 | Audit/fix match_documents en production |
| 🔴 Critique | 1.2 | Fix blocage catalogue vide + hasKnowledgeBase serveur |
| 🟠 Important | 1.3 | Lien KB dans dashboard + sécurité ownership |
| 🟡 Valeur | 2.1 | Mission étape 0 wizard (création + édition) + carte Support Client |
| 🟡 Valeur | 2.2 | Champs DB agent_context / escalation_phone (IF NOT EXISTS) |
| 🟡 Valeur | 2.3 | Prompt Support Client + disable tools dans generator.js |
| 🟢 Fondation | 3.1 | Modèle source + chunks (prérequis au chunking) |
| 🟢 Fondation | 3.2 | Chunking ingestion KB |
| 🟢 Confort | 3.3 | Import PDF |
| 🟢 Confort | 3.4 | Import URL |
| 🔵 Futur | 4.1 | Décision architecture inscription (order vs booking) |
| 🔵 Futur | 4.2 | Moteur INSCRIPTION |
| 🔵 Futur | 4.3 | Dashboard inscriptions |
