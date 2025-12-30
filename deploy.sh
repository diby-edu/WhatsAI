#!/bin/bash

# Configuration
APP_DIR="/root/WhatsAI" # Changez ceci par votre chemin réel
ECOSYSTEM_FILE="ecosystem.config.js"

echo "🚀 Starting Deployment..."

# 1. Pull changes
echo "📥 Pulling latest code..."
git pull

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# 3. Build Next.js
echo "🏗️ Building Web App..."
npm run build

# 4. Restart Web App Only
echo "🔄 Restarting Web App (keeping Bot alive)..."
pm2 restart whatsai-web

echo "✅ App Deployment Complete!"
echo "⚠️  Note: If you updated whatsapp-service.js, please manually run: pm2 restart whatsai-bot"
