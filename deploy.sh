#!/bin/bash
# WhatsAI Deploy Script (Fusionné)
# ⚠️ Le bot peut être redémarré sans déconnecter WhatsApp (session persistante)

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              🚀 WhatsAI - Déploiement Complet                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

cd ~/WhatsAI

# Get current commit before update
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 1. Libérer la RAM pour le build (le bot garde sa session sur disque)
echo "🛑 Arrêt temporaire du bot pour libérer la RAM..."
pm2 stop whatsai-bot 2>/dev/null || true

# 2. Récupérer le code (forcé, sans conflits)
echo ""
echo "📥 Téléchargement des modifications..."
git fetch origin
git reset --hard origin/master

# Get new commit after update
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 3. Installer les dépendances
echo ""
echo "📦 Installation des dépendances..."
npm install --silent

# 4. Build (nettoyer le lock avant)
echo ""
echo "🔨 Compilation en cours..."
rm -f .next/lock
npm run build

# 5. Redémarrer les services
echo ""
echo "🔄 Redémarrage des services..."
pm2 restart whatsai-web 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-web
pm2 restart whatsai-bot 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-bot

# Wait for services to be ready
sleep 3

# Get PM2 info
WEB_STATUS=$(pm2 show whatsai-web 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "online")
BOT_STATUS=$(pm2 show whatsai-bot 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "online")

# Get resource usage
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f%%", $3/$2 * 100)}')

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                  ✅ DÉPLOIEMENT TERMINÉ                       ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  📌 Commit précédent : %-37s ║\n" "$OLD_COMMIT"
printf "║  📌 Commit actuel    : %-37s ║\n" "$NEW_COMMIT"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  🌐 WhatsAI Web      : %-37s ║\n" "$WEB_STATUS"
printf "║  🤖 WhatsApp Bot     : %-37s ║\n" "$BOT_STATUS"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  💾 Disque           : %-37s ║\n" "$DISK_USAGE utilisé"
printf "║  🧠 RAM              : %-37s ║\n" "$MEM_USAGE utilisée"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ WhatsApp reste connecté (session préservée sur disque)"
echo "🔗 Site: https://whatsai.duckdns.org"
echo ""
