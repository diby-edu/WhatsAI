# WazzapAI

> Plateforme SaaS d'automatisation WhatsApp propulsée par l'IA

WazzapAI permet aux entreprises de connecter des agents IA à WhatsApp pour automatiser leurs ventes, leur support client et leurs communications — avec ou sans catalogue natif. Disponible en web et en application mobile native (Android / iOS).

---

## Stack Technique

| Technologie | Usage |
|-------------|-------|
| **Next.js 16** (App Router) | Frontend + API Routes |
| **React 19** | UI avec React Compiler activé |
| **TypeScript** | Type safety |
| **Supabase** | Auth, PostgreSQL, Storage, pgvector (RAG) |
| **Baileys** | Sessions WhatsApp Web (QR + code de liaison) |
| **OpenAI (GPT-4o)** | Moteur conversationnel IA + embeddings |
| **Tailwind CSS v4** | Styles |
| **Framer Motion** | Animations |
| **next-intl** | Internationalisation (fr / en) |
| **Capacitor** | Application mobile Android & iOS |
| **Firebase** | Web Push Notifications + FCM natif |
| **CinetPay** | Gateway de paiement (Afrique) |
| **FeexPay** | Gateway Mobile Money multi-réseau |
| **PayDunya** | Hosted checkout |
| **Paystack** | Gateway de paiement alternatif |
| **Upstash Redis** | Rate limiting distribué |
| **Recharts** | Graphiques analytics |
| **Zod** | Validation des schémas |
| **node-cron** | Tâches planifiées (cron jobs) |
| **Nodemailer** | Emails transactionnels (SMTP) |
| **Sentry** | Error tracking & monitoring |
| **Pino** | Logging structuré |
| **PM2** | Gestion des processus (VPS) |

---

## Architecture

Deux services distincts tournent en parallèle sur le VPS :

```
whatsai-web   → Next.js (port 3000) — Dashboard, API publique, Admin
whatsai-bot   → Node.js standalone  — Sessions WhatsApp Baileys (port 3001/health)
```

Les deux services partagent la même base Supabase. La communication interne se fait via HTTP (`localhost:3001`) avec token sécurisé (`WHATSAPP_INTERNAL_API_TOKEN`).

Le déploiement est **automatique** : un push sur `master` déclenche le webhook GitHub → `/root/WhatsAI/deploy.sh` → build + restart PM2.

---

## Fonctionnalités

### Dashboard Utilisateur

- **Multi-agents** : création, configuration, activation/désactivation
- **Connexion WhatsApp** : QR Code ou code de liaison (pairing code 90s)
- **Missions agent** : E-commerce/Boutique, Support Client, Prise de RDV, Génération de leads
- **Mode e-commerce natif** : catalogue WazzapAI + checkout intégré
- **Mode catalogue externe via API** : synchronisation depuis plateforme tierce (Shopify, WooCommerce, etc.)
- **Base de connaissances (RAG)** : documents, FAQs, instructions — indexés avec pgvector pour recherche sémantique
- **Playground** : test de l'agent en direct depuis le dashboard
- **Conversations** : historique temps réel, réponses manuelles
- **Commandes** : suivi complet des commandes e-commerce
- **Leads** : gestion des prospects générés par les agents
- **Bookings** : gestion des rendez-vous pris via l'agent
- **Analytics** : graphiques de performance (messages, conversations, crédits)
- **Produits** : catalogue avec variantes, images, prix
- **Notifications** : push web (Firebase), email, centre de notifications in-app
- **Facturation** : plans, packs de crédits, historique des paiements
- **Parrainage** : programme de referral avec crédits mutuels
- **API Développeur** : clés API, webhooks, logs, documentation intégrée
- **Paramètres** : profil, photo, notifications, sécurité (mot de passe), parrainage
- **Recherche globale** : barre de recherche dans tout le dashboard

### Sécurité & Sessions

- **Biometric Lock** : verrouillage par empreinte digitale / Face ID (mobile natif)
- **Session Timeout** : déconnexion automatique après inactivité configurable
- **Vérification téléphone** : OTP envoyé via WhatsApp
- **Google Sign-In** : connexion/inscription Google (web + natif Capacitor)

### Application Mobile (Capacitor)

- App Android & iOS générée depuis la même codebase Next.js
- Push notifications natives (FCM)
- Authentification biométrique native
- Google Auth natif
- Hardware back button Android géré
- Splash screen + status bar personnalisés

### Paiements

- **CinetPay** — paiement en ligne (Afrique de l'Ouest/Centrale)
- **FeexPay** — Mobile Money multi-réseau (MTN, Moov, Wave, Orange, Celtiis, Coris...)
- **PayDunya** — hosted checkout
- **Paystack** — paiement en ligne alternatif
- **Paiement manuel** — screenshot + validation admin
- **Livraison digitale** — envoi automatique après paiement validé

### Admin

- Gestion utilisateurs, plans, abonnements (attribution manuelle possible)
- Gestion agents (vue globale)
- Gestion commandes, bookings, leads
- Broadcasts WhatsApp / Email / Push
- API Monitoring (kill switch, accès par user, clés, logs)
- Feature Flags (activation par mission, type produit)
- Cron management
- Analytics & exports
- Audit logs
- Diagnostics (sessions bot, état WhatsApp, base de données, DNS, intégrité)
- Mode maintenance (mise en pause globale)
- Credit packs & payouts
- Gestion des parainages
- Quotas par plan
- Emails transactionnels
- Webhooks sortants

### Lifecycle Comptes

- Compte test avec countdown et période de grâce
- Frozen grace (abonnement expiré, données conservées)
- Inactif (suppression planifiée)
- Onboarding guidé à l'inscription
- Complete Profile flow

### API Publique

- Authentification par clé API (`sk_live_...` / `sk_test_...`)
- Rate limiting par clé et par minute (Upstash Redis)
- Idempotency keys
- CORS ouvert sur `/api/public/*`
- Endpoints :
  - `POST /api/public/v1/send` — Envoi message direct
  - `POST /api/public/v1/trigger` — Déclenchement par événement (`order_created`, etc.)
  - `POST /api/public/v1/sync` — Synchronisation catalogue externe
  - `GET  /api/public/v1/status` — Statut agent
  - `GET  /api/public/v1/conversations` — Liste conversations
  - `GET  /api/public/v1/conversation` — Détail conversation
  - `POST /api/public/v1/incoming` — Réception message entrant (webhook entrant)
  - `POST /api/public/v1/platform-webhook` — Webhook plateforme externe
- Connexions plateformes : Shopify, WooCommerce, Chariow, Maketou, Generic

### Landing Page

- Hero, Comparaison, Comment ça marche, Cas d'usage
- Calculateur ROI
- Pricing (5 plans)
- Témoignages, FAQ, CTA, Footer
- Badge communauté WhatsApp
- Responsive mobile
- Pages légales : CGU, Politique de confidentialité, RGPD, Contact, À propos

---

## Plans Tarifaires

| Plan | Agents | API | Caractéristiques |
|------|--------|-----|-----------------|
| **Free** | 1 | — | Découverte |
| **Starter** | 1 | — | Usage basique |
| **Pro** | 3 | Inclus (1 000 req/mois) | PME |
| **Business** | 10 | Inclus (10 000 req/mois) | Multi-boutiques |
| **Scale** | Illimité | Illimité | Agences / Revendeurs |

> L'accès API peut également être souscrit séparément (abonnement API indépendant).

---

## Installation Locale

### Prérequis

- Node.js 18+
- Compte Supabase
- Clés OpenAI, CinetPay/FeexPay/PayDunya/Paystack, Firebase

### Installation

```bash
git clone https://github.com/diby-edu/WhatsAI.git
cd WhatsAI
npm install
```

> Le fichier `.npmrc` contient `legacy-peer-deps=true` pour la compatibilité React 19.

### Environnement

```bash
cp env.template .env.local
# Remplir les variables dans .env.local
```

Variables requises :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=https://wazzapai.com
NEXT_PUBLIC_APP_NAME=WazzapAI

# WhatsApp Bot (service interne)
WHATSAPP_BOT_URL=http://localhost:3001
WHATSAPP_INTERNAL_API_TOKEN=
WHATSAPP_SESSION_PATH=./.whatsapp-sessions

# Paiements (au moins un requis)
CINETPAY_SITE_ID=
CINETPAY_API_KEY=
CINETPAY_SECRET_KEY=
FEEXPAY_API_KEY=
FEEXPAY_SHOP_ID=
PAYDUNYA_MASTER_KEY=
PAYDUNYA_PRIVATE_KEY=
PAYDUNYA_PUBLIC_KEY=
PAYDUNYA_TOKEN=
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=

# Firebase (Push Notifications)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# Email (SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=WazzapAI
SMTP_FROM_EMAIL=noreply@wazzapai.com

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Déploiement auto (webhook GitHub)
DEPLOY_SECRET=

# Monitoring (optionnel)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_GA_ID=

# Google Analytics
NODE_ENV=development
```

### Développement

```bash
# Web
npm run dev

# Bot WhatsApp (dans un terminal séparé)
node whatsapp-service.js
```

---

## Déploiement VPS

### Automatique (recommandé)

Chaque push sur `master` déclenche automatiquement le déploiement via webhook GitHub :

```
Push → GitHub Webhook → /api/webhook/deploy → /root/WhatsAI/deploy.sh
```

Le script `deploy.sh` effectue : `git pull` → `npm install` → `npm run build` → `pm2 restart whatsai-web` → `pm2 restart whatsai-bot`.

Configurer la variable `DEPLOY_SECRET` dans `.env.local` et dans les secrets du webhook GitHub.

### Manuel

```bash
cd /root/WhatsAI
git pull
npm install
npm run build
pm2 restart whatsai-web
pm2 restart whatsai-bot
```

### Processus PM2

```
whatsai-web  (id:5) → Next.js build production (port 3000)
whatsai-bot  (id:4) → whatsapp-service.js (port 3001/health)
```

---

## Application Mobile

L'app mobile est générée avec **Capacitor** depuis la même codebase Next.js.

```bash
# Android
npx cap sync android
npx cap open android   # Ouvre Android Studio

# iOS
npx cap sync ios
npx cap open ios       # Ouvre Xcode
```

App ID : `com.wazzapai.app`

---

## License

MIT
