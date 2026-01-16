# 🔬 AUDIT EXHAUSTIF - WhatsAI Platform
## Checklist Permanente & Documentation Technique

**Version :** 1.0  
**Date :** 16 janvier 2026  
**Scope :** Frontend + Backend + Bot WhatsApp + Base de données

---

## 📊 VUE D'ENSEMBLE DE L'ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                      WhatsAI Platform                            │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND (Next.js)           │  BACKEND (API Routes + Bot)     │
│  ├── Landing Pages            │  ├── API Routes (20 catégories) │
│  ├── Dashboard Utilisateur    │  ├── WhatsApp Service (PM2)     │
│  ├── Admin Panel              │  └── Supabase (BDD + Auth)      │
│  └── Components               │                                  │
├─────────────────────────────────────────────────────────────────┤
│                    🧠 AI BRAIN (Cerveau)                         │
│  ├── generator.js    → Génération réponses OpenAI               │
│  ├── prompt-builder.js → Construction du système prompt         │
│  ├── tools.js        → Outils (create_order, etc.)              │
│  ├── rag.js          → Retrieval Augmented Generation           │
│  └── sentiment.js    → Analyse de sentiment                     │
└─────────────────────────────────────────────────────────────────┘
```

---

# 🧠 SECTION 1 : LE CERVEAU (AI BRAIN)

## 1.1 Generator (`src/lib/whatsapp/ai/generator.js`)

| Aspect | Description |
|--------|-------------|
| **Rôle** | Orchestrer les appels OpenAI, gérer les tool calls |
| **Taille** | ~280 lignes |
| **Dépendances** | tools.js, rag.js, prompt-builder.js, security.js |

### Fonctions clés :
- `preCheckCreateOrder()` - Valide les variantes AVANT exécution
- `generateAIResponse()` - Point d'entrée principal

### Checklist de vérification :
- [ ] Pre-check utilise `findMatchingOption()` de tools.js
- [ ] Retry OpenAI avec backoff exponentiel
- [ ] Timeout sur les appels OpenAI
- [ ] Logs DEBUG pour tool calls

---

## 1.2 Prompt Builder (`src/lib/whatsapp/ai/prompt-builder.js`)

| Aspect | Description |
|--------|-------------|
| **Rôle** | Construire le système prompt pour GPT |
| **Taille** | ~210 lignes |
| **Structure** | 7 sections ordonnées par priorité |

### Sections du prompt (ordre de priorité GPT) :
1. 🚨 **RÈGLE ABSOLUE** - Variantes (EN PREMIER !)
2. Identité de l'agent
3. Catalogue avec variantes
4. Ordre de collecte
5. Autres principes
6. Outils disponibles
7. Historique client + Infos entreprise

### Checklist de vérification :
- [ ] Variantes EN PREMIER (pas au milieu)
- [ ] Prix "Selon variante" au lieu de "0 FCFA"
- [ ] Rappels `selected_variants` dans le catalogue
- [ ] Longueur prompt < 15000 tokens

---

## 1.3 Tools (`src/lib/whatsapp/ai/tools.js`)

| Aspect | Description |
|--------|-------------|
| **Rôle** | Définir et exécuter les tools OpenAI |
| **Taille** | ~610 lignes |
| **Tools** | create_order, check_payment_status, send_image, create_booking |

### Tool `create_order` :
| Paramètre | Requis | Description |
|-----------|--------|-------------|
| items[] | ✅ | Liste des produits |
| items[].product_name | ✅ | Nom du produit |
| items[].quantity | ✅ | Quantité |
| items[].selected_variants | ⚠️ | Variantes si applicable |
| customer_name | ✅ | Nom client |
| customer_phone | ✅ | Téléphone |
| delivery_address | ❌ | Adresse livraison |

### Checklist de vérification :
- [ ] `findMatchingOption()` utilise matching flexible
- [ ] `findMatchingOption()` est exporté
- [ ] Logs détaillés pour chaque variante
- [ ] Gestion des produits sans variantes

---

## 1.4 RAG (`src/lib/whatsapp/ai/rag.js`)

| Aspect | Description |
|--------|-------------|
| **Rôle** | Retrieval Augmented Generation - chercher docs pertinents |
| **Taille** | ~120 lignes |
| **Dépendances** | OpenAI embeddings, Supabase vector search |

### Checklist de vérification :
- [ ] Filtrage par `agent_id` (sécurité)
- [ ] Threshold de similarité configurable
- [ ] Limite de documents retournés

---

## 1.5 Sentiment (`src/lib/whatsapp/ai/sentiment.js`)

| Aspect | Description |
|--------|-------------|
| **Rôle** | Analyser le sentiment du message client |
| **Taille** | ~30 lignes |
| **Output** | { sentiment: 'positive'/'neutral'/'negative', is_urgent: boolean }

### Checklist de vérification :
- [ ] Skip pour messages courts (< 10 chars)
- [ ] Cache pour patterns communs

---

# 🤖 SECTION 2 : BOT WHATSAPP

## 2.1 Message Handler (`src/lib/whatsapp/handlers/message.js`)

| Aspect | Description |
|--------|-------------|
| **Rôle** | Orchestrer le traitement des messages entrants |
| **Taille** | ~330 lignes |
| **Services** | 6 services injectés |

### Flux de traitement :
```
Message entrant
    ↓
[Rate Limiting] → Drop si > 10 msg/min
    ↓
[Phase 1] Vérifications initiales (agent, crédits)
    ↓
[Phase 2] Conversation (get/create)
    ↓
[Phase 3] Media (transcription audio, images)
    ↓
[Phase 4] Sentiment analysis
    ↓
[Phase 5] Génération AI
    ↓
[Phase 6] Envoi réponse + déduction crédits
```

### Checklist de vérification :
- [ ] Rate limiting actif (10 msg/min)
- [ ] Nettoyage mémoire rate limit (interval)
- [ ] Gestion erreurs avec ErrorHandler
- [ ] Pas de doublon (message.new.js supprimé)

---

## 2.2 Session Handler (`src/lib/whatsapp/handlers/session.js`)

| Aspect | Description |
|--------|-------------|
| **Rôle** | Gérer les connexions WhatsApp, QR codes, reconnexions |
| **Fonctions** | initWhatsApp, restoreSession, handleDisconnect |

### Checklist de vérification :
- [ ] Backoff exponentiel sur reconnexion
- [ ] Circuit breaker après N échecs
- [ ] Sauvegarde session dans Supabase

---

## 2.3 Services

| Service | Fichier | Rôle |
|---------|---------|------|
| **ConversationService** | conversation.service.js | CRUD conversations |
| **CreditsService** | credits.service.js | Déduction atomique crédits |
| **MediaService** | media.service.js | Transcription audio, images |
| **MessagingService** | messaging.service.js | Envoi messages WhatsApp |
| **AIService** | ai.service.js | Wrapper pour generator.js |
| **AnalyticsService** | analytics.service.js | Tracking événements |
| **ErrorHandler** | errors.js | Gestion centralisée erreurs |

### Checklist services :
- [ ] CreditsService utilise `rpc('deduct_credits')` (atomique)
- [ ] ConversationService limite historique à 20 messages
- [ ] ErrorHandler log vers Sentry (si configuré)

---

# 🖥️ SECTION 3 : FRONTEND PAGES

## 3.1 Pages Publiques

| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | page.tsx | Landing page |
| `/about` | about/page.tsx | À propos |
| `/contact` | contact/page.tsx | Formulaire contact |
| `/login` | login/page.tsx | Connexion |
| `/register` | register/page.tsx | Inscription |
| `/forgot-password` | forgot-password/page.tsx | Mot de passe oublié |
| `/reset-password` | reset-password/page.tsx | Réinitialisation |
| `/privacy` | privacy/page.tsx | Politique confidentialité |
| `/terms` | terms/page.tsx | CGU |
| `/gdpr` | gdpr/page.tsx | RGPD |

---

## 3.2 Dashboard Utilisateur (`/dashboard`)

| Route | Description | Fonctionnalités |
|-------|-------------|-----------------|
| `/dashboard` | Vue principale | Stats, agents récents |
| `/dashboard/agents` | Liste agents | CRUD agents WhatsApp |
| `/dashboard/agents/[id]` | Détail agent | Config, QR code |
| `/dashboard/agents/new` | Nouvel agent | Création assistant |
| `/dashboard/products` | Produits | Catalogue avec variantes |
| `/dashboard/products/[id]` | Édition produit | Variantes, prix, images |
| `/dashboard/orders` | Commandes | Liste, statuts, filtres |
| `/dashboard/orders/[id]` | Détail commande | Items, client, paiement |
| `/dashboard/conversations` | Conversations | Historique WhatsApp |
| `/dashboard/analytics` | Statistiques | Graphiques, KPIs |
| `/dashboard/billing` | Facturation | Crédits, paiements |
| `/dashboard/playground` | Test IA | Simulateur conversations |
| `/dashboard/settings` | Paramètres | Profil, préférences |
| `/dashboard/help` | Aide | Documentation |

### Checklist dashboard :
- [ ] Toutes les pages protégées par auth
- [ ] Sidebar responsive
- [ ] Données filtrées par user_id

---

## 3.3 Admin Panel (`/admin`)

| Route | Description | Accès |
|-------|-------------|-------|
| `/admin` | Dashboard admin | superadmin |
| `/admin/users` | Gestion utilisateurs | superadmin |
| `/admin/agents` | Tous les agents | admin |
| `/admin/orders` | Toutes commandes | admin |
| `/admin/payments` | Paiements | admin |
| `/admin/subscriptions` | Abonnements | admin |
| `/admin/credit-packs` | Packs crédits | superadmin |
| `/admin/plans` | Plans tarifaires | superadmin |
| `/admin/analytics` | Stats globales | admin |
| `/admin/broadcasts` | Messages broadcast | admin |
| `/admin/bookings` | Réservations | admin |
| `/admin/logs` | Logs système | superadmin |
| `/admin/diagnostics` | Debug système | superadmin |
| `/admin/features` | Feature flags | superadmin |
| `/admin/settings` | Config globale | superadmin |

### Checklist admin :
- [ ] Vérification rôle admin/superadmin
- [ ] Pagination sur toutes les listes
- [ ] Actions bulk (suppression, export)

---

# 🔌 SECTION 4 : API ROUTES

## 4.1 Routes Principales

| Catégorie | Route | Méthode | Description |
|-----------|-------|---------|-------------|
| **Agents** | `/api/agents` | GET/POST | CRUD agents |
| **Products** | `/api/products` | GET/POST | CRUD produits |
| **Orders** | `/api/orders` | GET/POST | CRUD commandes |
| **Conversations** | `/api/conversations` | GET | Historique messages |
| **Payments** | `/api/payments/webhook` | POST | Webhook CinetPay |
| **Dashboard** | `/api/dashboard/stats` | GET | Statistiques |
| **Profile** | `/api/profile` | GET/PUT | Profil utilisateur |
| **Knowledge** | `/api/knowledge` | GET/POST | Base connaissances RAG |

## 4.2 Webhooks

| Route | Provider | Sécurité |
|-------|----------|----------|
| `/api/payments/webhook` | CinetPay | HMAC SHA256 ✅ |
| `/api/payments/cinetpay/webhook` | CinetPay | HMAC SHA256 ✅ |
| `/api/webhook/deploy` | GitHub | Secret header ✅ |

### Checklist API :
- [ ] Tous les endpoints protégés par auth
- [ ] Webhooks validés avec signature
- [ ] Rate limiting sur routes sensibles
- [ ] Validation des inputs (Zod)

---

# 🗄️ SECTION 5 : BASE DE DONNÉES

## 5.1 Tables Principales

| Table | Description | RLS |
|-------|-------------|-----|
| `profiles` | Utilisateurs (crédits, rôle) | ✅ |
| `agents` | Assistants WhatsApp | ✅ |
| `products` | Catalogue produits | ✅ |
| `orders` | Commandes | ✅ |
| `order_items` | Détail commandes | ✅ |
| `conversations` | Historique conversations | ✅ |
| `messages` | Messages individuels | ✅ |
| `knowledge_base` | Documents RAG | ✅ |
| `bookings` | Réservations services | ✅ |
| `whatsapp_sessions` | Sessions Baileys | ✅ |

## 5.2 Fonctions PostgreSQL

| Fonction | Rôle | Atomique |
|----------|------|----------|
| `deduct_credits(uuid, int)` | Déduire crédits | ✅ |
| `increment(table, col, id)` | Incrémenter compteur | ✅ |

### Checklist BDD :
- [ ] Toutes les policies RLS actives
- [ ] Fonction `deduct_credits` déployée
- [ ] Indexes sur colonnes fréquemment filtrées
- [ ] Storage policy sécurisée (delete own only)

---

# 🔒 SECTION 6 : SÉCURITÉ

## 6.1 Checklist Sécurité

### Authentification
- [ ] Supabase Auth configuré
- [ ] Middleware vérifie session
- [ ] Routes admin protégées par rôle

### API
- [ ] Webhooks validés avec HMAC
- [ ] Rate limiting actif
- [ ] Inputs validés (Zod/TypeScript)

### Storage
- [ ] Policy suppression : own images only
- [ ] Policy upload : authenticated only
- [ ] Policy lecture : public

### Données sensibles
- [ ] Téléphones masqués dans logs
- [ ] Adresses masquées dans logs
- [ ] Pas de secrets en dur dans le code

---

# 🧪 SECTION 7 : TESTS DE VALIDATION

## 7.1 Tests Bot WhatsApp

| Test | Scénario | Résultat attendu |
|------|----------|------------------|
| Simple | "Je veux 5 Office" | Commande créée sans variante |
| Variante courte | "10 bougies petites" | Match "Petite (50g)" |
| Multi-produits | "5 office, 10 bougies, 20 t-shirts" | Toutes variantes demandées |
| Rate limit | 15 messages en < 1 min | Seuls 10 traités |
| Crédits | Créer commande | Crédits déduits atomiquement |

## 7.2 Tests Frontend

| Test | Page | Résultat attendu |
|------|------|------------------|
| Auth | /login | Redirection vers dashboard |
| Dashboard | /dashboard | Stats affichées |
| Produits | /dashboard/products | Liste avec variantes |
| Admin | /admin (sans rôle) | Redirection 403 |

---

# 📈 SECTION 8 : MÉTRIQUES DE QUALITÉ

| Métrique | Valeur Actuelle | Cible |
|----------|-----------------|-------|
| Fichiers AI Brain | 5 | - |
| Services WhatsApp | 7 | - |
| Routes API | 20 catégories | - |
| Pages Dashboard | 14 | - |
| Pages Admin | 15 | - |
| Rate Limiting | ✅ 10 msg/min | - |
| RLS Policies | ✅ Toutes tables | - |
| Webhook Validation | ✅ HMAC | - |
| Test Coverage | ~0% | > 50% |

---

# ✅ CHECKLIST DE DÉPLOIEMENT

## Avant chaque mise à jour

- [ ] Backup base de données
- [ ] Tests locaux passent
- [ ] Migrations SQL prêtes

## Après déploiement

- [ ] Service WhatsApp running (PM2)
- [ ] Agents reconnectés
- [ ] Test commande manuelle
- [ ] Logs sans erreurs

---

*Document mis à jour le 16 janvier 2026*
