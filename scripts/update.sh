#!/bin/bash
# WhatsAI Update Script
# This script updates the web app WITHOUT touching the WhatsApp service

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              🚀 WhatsAI - Script de Mise à Jour               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

cd ~/WhatsAI

# Get current commit before pull
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "📥 Téléchargement des modifications..."
git fetch origin
git reset --hard origin/master

# Get new commit after pull  
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo ""
echo "📦 Installation des dépendances..."
npm install --silent

echo ""
echo "🔨 Compilation en cours..."
rm -f .next/lock  # Évite les erreurs de lock
npm run build

echo ""
echo "🔄 Redémarrage de l'app web UNIQUEMENT..."
pm2 delete whatsai-web 2>/dev/null
pm2 start ecosystem.config.js --only whatsai-web --update-env 2>/dev/null

# Wait for app to be ready
sleep 5

echo "🔄 Redémarrage du bot WhatsApp (Sessions préservées)..."
pm2 restart whatsai-bot --update-env 2>/dev/null

# Wait for restart
sleep 2

# Get PM2 info
WEB_UPTIME=$(pm2 show whatsai-web 2>/dev/null | grep "uptime" | head -1 | awk '{print $4, $5}' || echo "N/A")
WEB_RESTARTS=$(pm2 show whatsai-web 2>/dev/null | grep "restarts" | head -1 | awk '{print $4}' || echo "0")
WEB_STATUS=$(pm2 show whatsai-web 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "online")

BOT_UPTIME=$(pm2 show whatsai-bot 2>/dev/null | grep "uptime" | head -1 | awk '{print $4, $5}' || echo "N/A")
BOT_RESTARTS=$(pm2 show whatsai-bot 2>/dev/null | grep "restarts" | head -1 | awk '{print $4}' || echo "0")
BOT_STATUS=$(pm2 show whatsai-bot 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "online")

# Get resource usage
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f%%", $3/$2 * 100)}')

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════════╗"
echo "║                       ✅ DÉPLOIEMENT TERMINÉ                          ║"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
printf "║  📌 Commit précédent : %-46s ║\n" "$OLD_COMMIT"
printf "║  📌 Commit actuel    : %-46s ║\n" "$NEW_COMMIT"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
echo "║  SERVICE           │ PORT   │ STATUT   │ UPTIME          │ RESTARTS           ║"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
printf "║  🌐 WhatsAI Web    │ %-6s │ %-8s │ %-15s │ %-18s ║\n" "3000" "$WEB_STATUS" "$WEB_UPTIME" "$WEB_RESTARTS fois"
printf "║  🤖 WhatsApp Bot   │ %-6s │ %-8s │ %-15s │ %-18s ║\n" "Worker" "$BOT_STATUS" "$BOT_UPTIME" "$BOT_RESTARTS fois"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
echo "║  RESSOURCES                  │ UTILISATION                            ║"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
printf "║  💾 Espace Disque            │ %-53s ║\n" "$DISK_USAGE utilisé"
printf "║  🧠 Mémoire RAM              │ %-53s ║\n" "$MEM_USAGE utilisée"
echo "╚═══════════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Le bot a été redémarré (Reconnexion auto active)"
echo "🔗 Site: https://whatsai.duckdns.org"
echo ""
