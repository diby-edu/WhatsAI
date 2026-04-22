# WazzapAI

> Plateforme SaaS d'automatisation WhatsApp propulsée par l'IA

WazzapAI permet aux entreprises de connecter des agents IA à WhatsApp pour automatiser leurs ventes, leur support client et leurs communications — avec ou sans catalogue natif.

---

## Stack Technique

| Technologie | Usage |
|-------------|-------|
| **Next.js 16** (App Router) | Frontend + API Routes |
| **TypeScript** | Type safety |
| **Supabase** | Auth, Base de données (PostgreSQL), Storage |
| **Baileys** | Sessions WhatsApp (QR + code de liaison) |
| **OpenAI (GPT-4o)** | Moteur conversationnel IA |
| **Tailwind CSS v4** | Styles |
| **Framer Motion** | Animations |
| **next-intl** | Internationalisation (fr / en) |
| **Firebase** | Web Push Notifications |
| **CinetPay / FeexPay** | Gateways de paiement |
| **PM2** | Gestion des processus (VPS) |

---

## Architecture

Deux services distincts tournent en parallèle sur le VPS :

```
whatsai-web   → Next.js (port 3000) — Dashboard, API publique, Admin
whatsai-bot   → Node.js standalone  — Sessions WhatsApp Baileys (port 3001/health)
```

Les deux services partagent la même base Supabase. La communication interne se fait via HTTP (`localhost:3001`) avec token sécurisé.

---

## Fonctionnalités

### Dashboard Utilisateur
- **Multi-agents** : création, configuration, activation/désactivation
- **Connexion WhatsApp** : QR Code ou code de liaison (pairing code 90s)
- **Missions agent** : E-commerce/Boutique, Support Client, Prise de RDV, Génération de leads...
- **Mode e-commerce natif** : catalogue WazzapAI + checkout intégré
- **Mode catalogue externe via API** : synchronisation depuis plateforme tierce (Shopify, WooCommerce, etc.)
- **Base de connaissances** : documents, FAQs, instructions
- **Conversations** : historique temps réel, réponses manuelles
- **Leads & commandes** : suivi complet
- **Notifications** : push web (Firebase), email
- **Facturation** : plans, packs de crédits, historique
- **API Développeur** : clés API, webhooks, logs, documentation intégrée

### Paiements
- CinetPay (automatisé)
- FeexPay
- Mobile Money (screenshot + validation manuelle)
- Cash on Delivery (COD)

### Admin
- Gestion utilisateurs, plans, abonnements
- Gestion agents (vue globale)
- Broadcasts WhatsApp / Email / Push
- API Monitoring (kill switch, accès par user, clés, logs)
- Feature Flags (activation par mission, type produit)
- Analytics & exports
- Audit logs
- Diagnostics (sessions bot, état WhatsApp)
- Credit packs & payouts

### API Publique
- Authentification par clé API (`sk_live_...` / `sk_test_...`)
- Rate limiting par clé et par minute
- Idempotency keys
- Endpoints :
  - `POST /api/public/v1/send` — Envoi message direct
  - `POST /api/public/v1/trigger` — Déclenchement par événement (`order_created`, etc.)
  - `POST /api/public/v1/sync` — Synchronisation catalogue externe
  - `GET  /api/public/v1/status` — Statut agent
  - `GET  /api/public/v1/conversations` — Liste conversations
  - `GET  /api/public/v1/conversation` — Détail conversation
- Webhooks entrants (plateforme → WazzapAI)
- Connexions plateformes : Shopify, WooCommerce, Chariow, Maketou, Generic

### Landing Page
- Hero, Comparaison, Comment ça marche, Cas d'usage
- Calculateur ROI
- Pricing (5 plans)
- Témoignages, FAQ, CTA, Footer
- Badge communauté WhatsApp
- Responsive mobile

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
- Clés OpenAI, CinetPay/FeexPay, Firebase

### Installation
```bash
git clone https://github.com/diby-edu/WhatsAI.git
cd WhatsAI
npm install
```

### Environnement
```bash
cp env.template .env.local
# Remplir les variables dans .env.local
```

Variables requises :
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
CINETPAY_SITE_ID=
CINETPAY_API_KEY=
WHATSAPP_BOT_URL=http://localhost:3001
WHATSAPP_INTERNAL_API_TOKEN=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
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

```bash
# Sur le VPS
cd /root/WhatsAI
git pull
npm install
npm run build
pm2 restart whatsai-web
pm2 restart whatsai-bot
```

Processus PM2 :
```
whatsai-web   → Next.js (build production)
whatsai-bot   → whatsapp-service.js
```

> Le fichier `.npmrc` contient `legacy-peer-deps=true` pour la compatibilité React 19.

---

## License
MIT
