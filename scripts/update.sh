#!/bin/bash
# WhatsAI Update Script
# This script updates the web app WITHOUT touching the WhatsApp service

echo "🚀 Mise à jour de WhatsAI..."
cd ~/WhatsAI

echo "📥 Téléchargement des modifications..."
git pull

echo "📦 Installation des dépendances..."
npm install

echo "🔨 Compilation..."
npm run build

echo "🔄 Redémarrage de l'app web UNIQUEMENT..."
# Only restart the web app, NOT the WhatsApp service
pm2 restart whatsai-web --update-env 2>/dev/null || pm2 restart whatsai 2>/dev/null

echo "✅ WhatsAI mis à jour avec succès !"
echo "⚠️  Le service WhatsApp n'a PAS été redémarré (sessions préservées)"
