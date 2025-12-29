---
description: Guide complet pour déployer WhatsAI sur Hostinger VPS avec architecture robuste
---

# 🚀 Déploiement WhatsAI sur Hostinger VPS

## ⚠️ ARCHITECTURE ROBUSTE

WhatsAI utilise **2 services séparés** :

| Service | Description | Redémarrage |
|---------|-------------|-------------|
| `whatsai-web` | Application Next.js | ✅ OK pendant les déploiements |
| `whatsai-bot` | Service WhatsApp | ❌ JAMAIS (sauf déconnexion manuelle) |

Cette architecture garantit que le **bot WhatsApp NE SE DÉCONNECTE JAMAIS** lors des mises à jour du code.

---

## ÉTAPE 1 : Prérequis

- Compte Hostinger avec VPS KVM1 (~5$/mois)
- Code WhatsAI sur GitHub
- Domaine (ex: whatsai.duckdns.org)

---

## ÉTAPE 2 : Installation initiale

```bash
# Mettre à jour et installer les outils
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git nginx

# Installer PM2 globalement
npm install -g pm2

# Cloner le projet
cd ~
git clone https://github.com/diby-edu/WhatsAI.git
cd WhatsAI
npm install
```

---

```

### ⚠️ IMPORTANT : Configurer le SWAP (Anti-Crash)
Le build Next.js demande beaucoup de mémoire. Pour éviter l'erreur `Aborted (core dumped)`, ajoutez 4GB de swap :

```bash
# 1. Créer un fichier de 4GB
fallocate -l 4G /swapfile

# 2. Sécuriser les permissions
chmod 600 /swapfile

# 3. Initialiser le swap
mkswap /swapfile
swapon /swapfile

# 4. Rendre permanent (au redémarrage)
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# 5. Vérifier
free -h
```

---

## ÉTAPE 3 : Configuration

```bash
# Créer le fichier .env.local
nano .env.local
```

Contenu :
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# CinetPay
CINETPAY_API_KEY=xxx
CINETPAY_SITE_ID=xxx
CINETPAY_SECRET_KEY=xxx

# NextAuth
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://votre-domaine.com
NEXT_PUBLIC_APP_URL=https://votre-domaine.com
```

---

## ÉTAPE 4 : Build et lancement avec PM2

```bash
# Compiler l'application
npm run build

# Démarrer les 2 services avec PM2
pm2 start ecosystem.config.js

# Configurer le démarrage automatique
pm2 startup
pm2 save

# Vérifier le statut
pm2 status
```

Vous devez voir :
```
┌─────────────┬────┬─────────┬──────────┐
│ name        │ id │ status  │ restart  │
├─────────────┼────┼─────────┼──────────┤
│ whatsai-web │ 0  │ online  │ 0        │
│ whatsai-bot │ 1  │ online  │ 0        │
└─────────────┴────┴─────────┴──────────┘
```

---

## ÉTAPE 5 : Nginx et SSL

```bash
# Configuration Nginx
nano /etc/nginx/sites-available/whatsai
```

Contenu :
```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

```bash
# Activer et redémarrer
ln -sf /etc/nginx/sites-available/whatsai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# SSL
apt install -y certbot python3-certbot-nginx
certbot --nginx -d votre-domaine.com
```

---

## 📋 COMMANDES IMPORTANTES

### Mise à jour (SANS déconnecter WhatsApp)
```bash
# UTILISER LE SCRIPT DE MISE À JOUR
~/WhatsAI/scripts/update.sh

# OU manuellement :
cd ~/WhatsAI
git pull
npm install
npm run build
pm2 restart whatsai-web  # ⚠️ SEULEMENT web, PAS bot !
```

### Logs
```bash
# Logs de l'app web
pm2 logs whatsai-web

# Logs du bot WhatsApp
pm2 logs whatsai-bot

# Tous les logs
pm2 logs
```

### Redémarrer (avec précaution)
```bash
# App web seulement (sessions WhatsApp préservées)
pm2 restart whatsai-web

# Bot WhatsApp (⚠️ DÉCONNECTE les sessions !)
pm2 restart whatsai-bot
```

---

## 🔧 Résolution de problèmes

### Le bot ne répond pas
```bash
# Vérifier le statut
pm2 status

# Voir les logs du bot
pm2 logs whatsai-bot --lines 50
```

### Reconnecter WhatsApp manuellement
1. Aller sur https://votre-domaine.com/dashboard/agents
2. Cliquer sur l'agent → Connecter
3. Scanner le QR code

### Redémarrer complètement (UNIQUEMENT si nécessaire)
```bash
pm2 restart all
```

---

## ✅ Résumé Architecture

```
┌─────────────────────────────────────────────┐
│              HOSTINGER VPS                   │
├─────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │   whatsai-web   │  │   whatsai-bot    │  │
│  │   (Next.js)     │  │   (WhatsApp)     │  │
│  │                 │  │                  │  │
│  │  Peut restart   │  │  NE RESTART PAS  │  │
│  │  librement      │  │  pendant deploy  │  │
│  └─────────────────┘  └──────────────────┘  │
│           │                    │            │
│           └──────┬─────────────┘            │
│                  │                          │
│           ┌──────▼──────┐                   │
│           │  Supabase   │                   │
│           │  (DB sync)  │                   │
│           └─────────────┘                   │
└─────────────────────────────────────────────┘
```

**Le bot WhatsApp reste connecté 24/7, même pendant les déploiements !** 🎉
