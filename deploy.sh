#!/bin/bash
# WhatsAI Deploy Script v2
# Redémarre TOUJOURS les deux services
# Sessions WhatsApp préservées grâce à gracefulShutdown + session-restore

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              🚀 WhatsAI - Déploiement v2                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

cd ~/WhatsAI

# Get current local commit (before pull)
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 1. Récupérer le code
echo "📥 Téléchargement des modifications..."
git fetch origin
git reset --hard origin/master
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 2. Installer les dépendances
echo ""
echo "📦 Installation des dépendances..."
npm install --silent

# 3. Build
echo ""
echo "🔨 Compilation en cours..."
rm -f .next/lock
npm run build

# 4. Nettoyage PM2 — supprimer les anciens processus fantômes
echo ""
echo "🧹 Nettoyage PM2..."
# Supprimer l'ancien nom 'wazzapai-web' si il existe (erreur de nommage historique)
pm2 delete wazzapai-web 2>/dev/null || true
# Supprimer les instances errored
pm2 delete whatsai-web 2>/dev/null || true
pm2 delete whatsai-bot 2>/dev/null || true

# 5. Démarrer proprement depuis ecosystem.config.js
echo ""
echo "🔄 Démarrage des services..."
pm2 start ecosystem.config.js

# Sauvegarder la config PM2
pm2 save 2>/dev/null || true

# Wait for services to be ready
sleep 3

# Get PM2 info
WEB_UPTIME=$(pm2 show whatsai-web 2>/dev/null | grep "uptime" | head -1 | awk '{print $4, $5}' || echo "N/A")
WEB_RESTARTS=$(pm2 show whatsai-web 2>/dev/null | grep "restarts" | head -1 | awk '{print $4}' || echo "0")
WEB_STATUS=$(pm2 show whatsai-web 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "unknown")

BOT_UPTIME=$(pm2 show whatsai-bot 2>/dev/null | grep "uptime" | head -1 | awk '{print $4, $5}' || echo "N/A")
BOT_RESTARTS=$(pm2 show whatsai-bot 2>/dev/null | grep "restarts" | head -1 | awk '{print $4}' || echo "0")
BOT_STATUS=$(pm2 show whatsai-bot 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "unknown")

# Get resource usage
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f%%", $3/$2 * 100)}')

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════════╗"
echo "║                       ✅ DÉPLOIEMENT TERMINÉ                                     ║"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
printf "║  📌 Ancien commit    : %-56s ║\n" "$OLD_COMMIT"
printf "║  📌 Nouveau commit   : %-56s ║\n" "$NEW_COMMIT"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
echo "║  SERVICE           │ STATUT   │ UPTIME          │ RESTARTS                       ║"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
printf "║  🌐 WhatsAI Web    │ %-8s │ %-15s │ %-30s ║\n" "$WEB_STATUS" "$WEB_UPTIME" "$WEB_RESTARTS"
printf "║  🤖 WhatsApp Bot   │ %-8s │ %-15s │ %-30s ║\n" "$BOT_STATUS" "$BOT_UPTIME" "$BOT_RESTARTS"
echo "╠═══════════════════════════════════════════════════════════════════════════════════╣"
printf "║  💾 Disque  : %-66s ║\n" "$DISK_USAGE"
printf "║  🧠 RAM     : %-66s ║\n" "$MEM_USAGE"
echo "╚═══════════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🔗 Site: https://wazzapai.com"
echo "✅ Bot + Web redémarrés — Sessions WhatsApp préservées"
echo ""
