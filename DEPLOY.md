# Guide de Déploiement WhatsAI

Ce guide détaille les étapes pour déployer l'application WhatsAI sur un VPS (Ubunto/Debian recommandé).

## 1. Prérequis sur le VPS

Assurez-vous que Node.js 18+ et NPM sont installés.

```bash
# Vérifier les versions
node -v
npm -v
```

Installez PM2 (Gestionnaire de processus) globalement :
```bash
npm install -g pm2
```

## 2. Installation du Projet

Clonez votre répertoire ou copiez les fichiers sur le VPS (par exemple dans `/var/www/whatsai` ou `/root/whatsai`).

```bash
cd /chemin/vers/votre/dossier/whatsai

# Installer les dépendances
npm install --legacy-peer-deps
```

## 3. Configuration de l'Environnement

Créez un fichier `.env.local` ou `.env.production` avec vos clés secrètes.
**Important**: Assurez-vous d'avoir ces clés critiques :

```ini
# Supabase
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role_(critique_pour_le_bot)

# OpenAI
OPENAI_API_KEY=sk-...

# CinetPay
CINETPAY_API_KEY=...
CINETPAY_SITE_ID=...
CINETPAY_SECRET_KEY=...

# WhatsApp Session Path (Optionnel, par défaut ./.whatsapp-sessions)
WHATSAPP_SESSION_PATH=./.whatsapp-sessions
```

## 4. Construction (Build)

Compilez l'application Next.js :

```bash
npm run build
```

## 5. Configuration PM2

Ouvrez le fichier `ecosystem.config.js` à la racine et vérifiez la ligne `cwd` (Current Working Directory).
Mettez le chemin réel de votre dossier sur le VPS.

```javascript
// Exemple si vous êtes dans /var/www/whatsai
cwd: '/var/www/whatsai',
```

## 6. Lancement

Lancez l'application avec PM2 :

```bash
pm2 start ecosystem.config.js
```

Cela va démarrer deux processus :
1.  `whatsai-web` : Le site web Next.js (Port 3000)
2.  `whatsai-bot` : Le service WhatsApp autonome

## 7. Gestion des Mises à Jour

Si vous mettez à jour le code du site web, redémarrez **uniquement** le site pour éviter de déconnecter les WhatsApp :

```bash
# Après un git pull et npm run build
pm2 restart whatsai-web
```

⚠️ **Ne redémarrez `whatsai-bot` que si vous avez modifié le fichier `whatsapp-service.js`**, sinon vous risquez de couper les connexions actives des clients.

## 8. Logs et Debug

Pour voir ce qui se passe (erreurs, connexions...) :

```bash
# Voir tous les logs
pm2 logs

# Voir uniquement le bot
pm2 logs whatsai-bot
```

## Architecture

- **Web (Next.js)** : Gère le Dashboard, l'API de réponse manuelle (met les messages en file d'attente), et la facturation.
- **Bot (Standalone)** : Lit la file d'attente DB, envoie les messages, écoute WhatsApp, et gère l'IA (Texte + Voix).
