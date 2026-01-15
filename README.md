# WhatsAI 🤖💬 (v2.2 - Cerveau Adaptatif)

> Plateforme SaaS d'automatisation WhatsApp propulsée par l'IA - **Version 2.2**

WhatsAI permet aux entreprises d'automatiser leurs conversations WhatsApp grâce à des agents IA intelligents qui qualifient les leads, répondent aux clients 24/7 et boostent les conversions.

## 🚀 Nouveautés v2.2 (Cerveau Adaptatif)

- 🧠 **Prompt Adaptatif** : Le bot construit son intelligence en temps réel (`prompt-builder.js`).
- 💳 **3 Flux de Paiement** :
  - **CinetPay** (Automatisé)
  - **Mobile Money Direct** (Hautement optimisé pour l'Afrique : Screenshot + Validation)
  - **Cash on Delivery (COD)** (Paiement à la livraison)
- 🔒 **Validation Robuste** : Système anti-hallucination sur les numéros de téléphone.

## 🛠️ Stack Technique

| Technologie | Usage |
|-------------|-------|
| **Next.js 14** | Frontend + API Routes |
| **TypeScript** | Type safety |
| **Supabase** | Auth, Database, Storage (PostgreSQL) |
| **Baileys** | WhatsApp CRM & Socket |
| **OpenAI (GPT-4o)** | Cerveau Conversationnel |
| **CinetPay** | Gateway Paiement |

## 📦 Installation & Déploiement

### 1. Prérequis
- Node.js 18+
- Compte Supabase
- Clé OpenAI & CinetPay

### 2. Cloner & Installer
```bash
git clone [repo_url]
cd wazzap-clone
npm install
```

### 3. Environnement
Copier `.env.template` vers `.env.local` et remplir les clés :
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
CINETPAY_SITE_ID=...
```

### 4. Déploiement Intelligent (Script v2)
Utilisez le script intelligent qui ne redémarre le bot que si nécessaire :
```bash
chmod +x deploy.sh
./deploy.sh
```

## 📁 Architecture Clé (v2.2)

```
src/lib/whatsapp/
├── ai/
│   ├── generator.js        # Chef d'orchestre (appelle le builder)
│   ├── prompt-builder.js   # 🧠 Cerveau Adaptatif (12 Principes)
│   └── tools.js            # Outils (create_order, check_status...)
├── handlers/
│   ├── message.js          # Gestion messages (Texte/Audio/Image)
│   └── session.js          # Gestion socket WhatsApp
```

## 📊 Monitoring (SQL Views)
Le suivi se fait via des vues SQL dédiées dans Supabase :
- `view_analytics_payments` : Performance par canal
- `view_admin_alerts` : Alertes "Morts Vivants" (Screenshots en attente)

## 💰 Plans Tarifaires

| Plan | Prix/mois | Fonctionnalités |
|------|-----------|-----------------|
| **Starter** | 15,000 F | 1 Agent, CinetPay |
| **Pro** | 35,000 F | 2 Agents, MM Direct |
| **Business** | 85,000 F | 4 Agents, Tout illimité |

## 📝 License
MIT
