#!/bin/bash

echo "🚀 Démarrage du déploiement..."

# 1. Récupérer le code
echo "📥 Pulling latest code..."
git pull

# 2. Installer les dépendances (AVEC devDependencies pour le build)
echo "📦 Installing dependencies..."
npm install --include=dev

# 3. Construire le site
echo "🏗️ Building Web App..."
npm run build

# 4. Redémarrer le site
echo "🔄 Restarting Web App..."
pm2 restart whatsai-web

# 5. Redémarrer le bot (Optionnel)
echo ""
echo "🤖 Voulez-vous aussi redémarrer le Bot WhatsApp ? (utile si whatsapp-service.js a changé)"
read -p "Tapez 'y' pour oui, 'n' pour non : " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "🔄 Restarting WhatsApp Bot..."
    pm2 restart whatsai-bot
fi

echo ""
echo "✅ Déploiement terminé avec succès !"
