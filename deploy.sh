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

echo ""
echo "✅ Déploiement Web terminé !"
echo "ℹ️  Si vous devez mettre à jour le bot, lancez manuellement : pm2 restart whatsai-bot"
