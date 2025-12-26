# WhatsAI 🤖💬

> Plateforme SaaS d'automatisation WhatsApp propulsée par l'IA

WhatsAI permet aux entreprises d'automatiser leurs conversations WhatsApp grâce à des agents IA intelligents qui qualifient les leads, répondent aux clients 24/7 et boostent les conversions.

## 🚀 Fonctionnalités

- ✅ **Agents IA** - Créez des assistants virtuels personnalisés
- ✅ **Multi-WhatsApp** - Connectez plusieurs numéros WhatsApp
- ✅ **Réponses automatiques** - IA conversationnelle 24/7
- ✅ **Qualification de leads** - Identifiez les prospects chauds
- ✅ **Analytics** - Suivez vos performances
- ✅ **Base de connaissances** - Entraînez vos agents sur vos données

## 🛠️ Stack Technique

| Technologie | Usage |
|-------------|-------|
| **Next.js 14** | Frontend + API Routes |
| **TypeScript** | Type safety |
| **Supabase** | Auth, Database, Storage |
| **TailwindCSS** | Styling |
| **Framer Motion** | Animations |
| **Baileys** | WhatsApp integration |
| **OpenAI** | IA conversationnelle |
| **CinetPay** | Paiements |

## 📦 Installation

### Prérequis

- Node.js 18+
- npm ou yarn
- Compte Supabase
- Clé API OpenAI (optionnel pour le dev)

### 1. Cloner le projet

```bash
cd h:/WHATSAPP/wazzap-clone
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

Copier le fichier template :

```bash
cp env.template .env.local
```

Puis éditer `.env.local` avec vos credentials :

```env
# Supabase (obligatoire)
NEXT_PUBLIC_SUPABASE_URL=votre_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# OpenAI (pour l'IA)
OPENAI_API_KEY=votre_cle_openai

# CinetPay (pour les paiements)
CINETPAY_SITE_ID=votre_site_id
CINETPAY_API_KEY=votre_api_key
```

### 4. Configurer la base de données

Dans le dashboard Supabase, exécutez les migrations SQL :

1. Allez dans **SQL Editor**
2. Exécutez `supabase/migrations/001_initial_schema.sql`
3. Exécutez `supabase/migrations/002_rls_policies.sql`

### 5. Lancer le serveur

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

## 📁 Structure du Projet

```
wazzap-clone/
├── src/
│   ├── app/                    # Pages Next.js (App Router)
│   │   ├── api/                # API Routes
│   │   │   ├── agents/         # CRUD agents
│   │   │   ├── conversations/  # Conversations
│   │   │   ├── dashboard/      # Stats
│   │   │   └── profile/        # Profil utilisateur
│   │   ├── dashboard/          # Dashboard pages
│   │   ├── login/              # Authentification
│   │   └── register/           # Inscription
│   ├── components/             # Composants réutilisables
│   ├── lib/                    # Utilitaires
│   │   ├── supabase/           # Clients Supabase
│   │   ├── api-utils.ts        # Helpers API
│   │   └── plans.ts            # Configuration plans
│   └── types/                  # Types TypeScript
├── supabase/
│   └── migrations/             # Schéma SQL
└── env.template                # Template variables d'env
```

## 📊 Base de Données

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | Profils utilisateurs (extends auth.users) |
| `agents` | Agents IA configurés |
| `whatsapp_sessions` | Sessions WhatsApp actives |
| `conversations` | Conversations avec contacts |
| `messages` | Messages échangés |
| `knowledge_base` | Documents d'entraînement |
| `subscriptions` | Abonnements actifs |
| `payments` | Historique paiements |

## 💰 Plans Tarifaires

| Plan | Prix/mois | Messages | Agents | WhatsApp |
|------|-----------|----------|--------|----------|
| Gratuit | 0 FCFA | 100 | 1 | 1 |
| Starter | 15,000 FCFA | 2,000 | 1 | 1 |
| Pro | 35,000 FCFA | 5,000 | 2 | 2 |
| Business | 85,000 FCFA | 30,000 | 4 | 4 |

## 🔧 API Routes

### Agents
- `GET /api/agents` - Liste des agents
- `POST /api/agents` - Créer un agent
- `GET /api/agents/:id` - Détails d'un agent
- `PATCH /api/agents/:id` - Modifier un agent
- `DELETE /api/agents/:id` - Supprimer un agent

### Conversations
- `GET /api/conversations` - Liste des conversations
- `GET /api/conversations/:id` - Conversation + messages
- `PATCH /api/conversations/:id` - Modifier statut

### Dashboard
- `GET /api/dashboard/stats` - Statistiques

### Profil
- `GET /api/profile` - Profil utilisateur
- `PATCH /api/profile` - Modifier profil

## 📱 WhatsApp Integration

L'intégration WhatsApp utilise **Baileys** (solution non-officielle).

### Connexion
1. **Desktop** : Scanner le QR code affiché
2. **Mobile** : Utiliser le code de liaison à 8 chiffres

### Fonctionnement
1. Utilisateur scanne le QR / entre le code
2. Session WhatsApp sauvegardée en base
3. Messages entrants traités par l'IA
4. Réponses envoyées automatiquement

## 🚀 Déploiement

### Vercel

```bash
npm run build
vercel --prod
```

### Variables d'environnement à configurer sur Vercel :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `CINETPAY_SITE_ID`
- `CINETPAY_API_KEY`

## 📝 License

MIT
