---
description: Guide complet pour déployer WhatsAI sur Hostinger VPS
---

# 🚀 Déploiement WhatsAI sur Hostinger VPS

## Prérequis
- Compte Hostinger avec VPS KVM1 (~5$/mois)
- Votre code WhatsAI sur GitHub

---

## ÉTAPE 1 : Commander le VPS Hostinger

1. Aller sur [hostinger.com/vps-hosting](https://www.hostinger.com/vps-hosting)
2. Choisir **KVM 1** (4 Go RAM, 1 vCPU, 50 Go SSD)
3. Créer un compte et payer (~5$/mois)
4. Dans le panneau de contrôle, aller dans **VPS** → **Setup**
5. Choisir :
   - **OS** : Ubuntu 22.04
   - **Datacenter** : Europe (France ou Pays-Bas de préférence)
   - **Définir un mot de passe root** (notez-le !)
6. Attendre 2-3 minutes que le VPS soit créé
7. **Noter l'adresse IP** du VPS (ex: 123.45.67.89)

---

## ÉTAPE 2 : Se connecter au VPS

### Option A : Via le panneau Hostinger (plus facile)
1. Dans le panneau VPS Hostinger, cliquer sur **Terminal** ou **Browser Terminal**
2. Vous êtes connecté en tant que `root`

### Option B : Via SSH (Windows Terminal ou PowerShell)
```powershell
ssh root@VOTRE_IP_VPS
```
Entrer le mot de passe root quand demandé.

---

## ÉTAPE 3 : Installer Node.js 20

Copier-coller ces commandes une par une :

```bash
# Mettre à jour le système
apt update && apt upgrade -y

# Installer Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Vérifier l'installation
node --version
npm --version
```

Résultat attendu : `v20.x.x` et `10.x.x`

---

## ÉTAPE 4 : Installer les outils nécessaires

```bash
# Installer Git
apt install -y git

# Installer PM2 (gestionnaire de processus)
npm install -g pm2

# Installer nginx (serveur web)
apt install -y nginx
```

---

## ÉTAPE 5 : Cloner le projet WhatsAI

```bash
# Aller dans le dossier des applications
cd /var/www

# Cloner le repo (remplacer par votre URL GitHub)
git clone https://github.com/diby-edu/WhatsAI.git

# Entrer dans le dossier
cd WhatsAI

# Installer les dépendances
npm install
```

---

## ÉTAPE 6 : Configurer les variables d'environnement

```bash
# Créer le fichier .env.local
nano .env.local
```

Coller ce contenu (adapter avec vos vraies valeurs) :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# OpenAI
OPENAI_API_KEY=sk-votre-cle-openai

# CinetPay
CINETPAY_API_KEY=votre_api_key
CINETPAY_SITE_ID=votre_site_id
CINETPAY_SECRET_KEY=votre_secret_key

# NextAuth
NEXTAUTH_SECRET=une-longue-chaine-aleatoire
NEXTAUTH_URL=https://votre-domaine.com

# Application
NEXT_PUBLIC_APP_URL=https://votre-domaine.com
```

Pour sauvegarder : `Ctrl+X`, puis `Y`, puis `Entrée`

---

## ÉTAPE 7 : Compiler l'application

```bash
# Build de production
npm run build
```

⏱️ Cela peut prendre 2-5 minutes.

---

## ÉTAPE 8 : Lancer l'application avec PM2

```bash
# Démarrer l'application
pm2 start npm --name "whatsai" -- start

# Configurer le démarrage automatique
pm2 startup
pm2 save

# Voir les logs
pm2 logs whatsai
```

L'application tourne maintenant sur le port 3000 !

---

## ÉTAPE 9 : Configurer Nginx (proxy inverse)

```bash
# Créer la configuration nginx
nano /etc/nginx/sites-available/whatsai
```

Coller ce contenu :

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

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

Sauvegarder : `Ctrl+X`, `Y`, `Entrée`

```bash
# Activer le site
ln -s /etc/nginx/sites-available/whatsai /etc/nginx/sites-enabled/

# Supprimer la config par défaut
rm /etc/nginx/sites-enabled/default

# Tester la configuration
nginx -t

# Redémarrer nginx
systemctl restart nginx
```

---

## ÉTAPE 10 : Configurer le domaine (optionnel)

1. Dans le panneau de votre registrar DNS, ajouter un enregistrement A :
   - **Type** : A
   - **Nom** : @ (ou www)
   - **Valeur** : IP_DU_VPS
   - **TTL** : 3600

2. Attendre 5-30 minutes pour la propagation DNS

---

## ÉTAPE 11 : Installer le certificat SSL (HTTPS)

```bash
# Installer Certbot
apt install -y certbot python3-certbot-nginx

# Obtenir le certificat SSL
certbot --nginx -d votre-domaine.com -d www.votre-domaine.com

# Suivre les instructions (email, accepter les conditions)
```

---

## ÉTAPE 12 : Tester l'application

1. Ouvrir votre navigateur
2. Aller sur `https://votre-domaine.com` (ou `http://IP_VPS:3000` si pas de domaine)
3. L'application WhatsAI devrait s'afficher ! 🎉

---

## 📋 Commandes utiles

```bash
# Voir le statut de l'application
pm2 status

# Voir les logs en temps réel
pm2 logs whatsai

# Redémarrer l'application
pm2 restart whatsai

# Arrêter l'application
pm2 stop whatsai

# Mettre à jour le code depuis GitHub
cd /var/www/WhatsAI
git pull
npm install
npm run build
pm2 restart whatsai
```

---

## 🔧 En cas de problème

### L'application ne démarre pas
```bash
pm2 logs whatsai --lines 50
```

### Erreur de mémoire
```bash
# Vérifier la RAM disponible
free -h
```

### Port 3000 déjà utilisé
```bash
# Trouver le processus
lsof -i :3000
# Tuer le processus
kill -9 PID
```

---

## ✅ Résumé

Après ce guide, vous aurez :
- ✅ WhatsAI qui tourne 24/7
- ✅ QR code scanné une seule fois
- ✅ SSL/HTTPS configuré
- ✅ Redémarrage automatique en cas de crash
- ✅ Domaine personnalisé

**Temps estimé : 30-45 minutes**
