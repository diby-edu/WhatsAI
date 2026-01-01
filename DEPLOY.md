# Guide de Déploiement WhatsAI

## 🚀 Procédure de Déploiement (Mise à jour)

### Méthode 1 : Automatique (Recommandée)
Un script `deploy.sh` est maintenant disponible à la racine. Il gère tout pour vous.

1. Connectez-vous au VPS :
   ```bash
   ssh root@srv1230238
   ```

2. Allez dans le dossier et lancez le script :
   ```bash
   cd /root/WhatsAI
   git pull
   chmod +x deploy.sh
   ./deploy.sh
   ```
   *(Le script vous demandera si vous voulez aussi redémarrer le bot)*

---

### Méthode 2 : Manuelle (En cas de problème)

Si le script échoue, voici les commandes exactes à lancer une par une :

1. **Mise à jour du code**
   ```bash
   cd /root/WhatsAI
   git pull
   ```

2. **Installation & Build** (Important : `--include=dev` pour Tailwind)
   ```bash
   npm install --include=dev
   npm run build
   ```

3. **Redémarrage Services**
   ```bash
   pm2 restart whatsai-web
   ```
   *Seulement si le code du bot a changé :*
   ```bash
   pm2 restart whatsai-bot
   ```

## Architecture

- **Web (Next.js)** : Gère le Dashboard, l'API, et la facturation.
- **Bot (Standalone)** : Lit la file d'attente DB, envoie les messages, gère l'IA.
