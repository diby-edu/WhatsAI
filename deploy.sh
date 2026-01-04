#!/bin/bash

echo "🚀 Démarrage du déploiement (Mode Sécurisé RAM)..."

# 1. Libérer de la mémoire AVANT le build (Crucial pour ce VPS)
echo "🛑 Arrêt temporaire du bot pour libérer la RAM..."
pm2 stop whatsai-bot
pm2 stop photopilot-web || true

# 2. Récupérer le code
echo "📥 Pulling latest code..."
git pull

# 3. Installer les dépendances
# 3. Installer les dépendances
echo "📦 Installing dependencies..."
# Forcer la réinstallation des deps critiques si besoin ou juste s'assurer que tout est là
npm install

# 4. Construire le site (Consomme beaucoup de RAM !)
echo "🏗️ Building Web App..."
rm -rf .next # Clean cache
npm run build

# 5. Redémarrer le site
echo "🔄 Restarting Web App..."
pm2 restart whatsai-web

# 6. Relancer le bot (Maintenant que le build est fini)
echo "🤖 Relance du Bot WhatsApp..."
pm2 restart whatsai-bot

echo ""
echo "✅ Déploiement terminé ! Tout est Vert ! 🟢"
