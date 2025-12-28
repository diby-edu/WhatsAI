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
git pull

# Get new commit after pull  
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo ""
echo "📦 Installation des dépendances..."
npm install --silent

echo ""
echo "🔨 Compilation en cours..."
npm run build

echo ""
echo "🔄 Redémarrage de l'app web UNIQUEMENT..."
pm2 reload whatsai-web --update-env 2>/dev/null || pm2 restart whatsai-web 2>/dev/null

# Get status info
WEB_STATUS=$(pm2 jq '.[] | select(.name=="whatsai-web") | .pm2_env.status' 2>/dev/null || echo "unknown")
BOT_STATUS=$(pm2 jq '.[] | select(.name=="whatsai-bot") | .pm2_env.status' 2>/dev/null || echo "unknown")
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f%%", $3/$2 * 100)}')

# Wait for app to be ready
sleep 3

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ DÉPLOIEMENT TERMINÉ                     ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
printf "║  📌 Commit précédent : %-38s ║\n" "$OLD_COMMIT"
printf "║  📌 Commit actuel    : %-38s ║\n" "$NEW_COMMIT"
echo "║                                                               ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  SERVICE                 │ STATUT                             ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  🌐 WhatsAI Web          │ %-35s ║\n" "$(pm2 show whatsai-web 2>/dev/null | grep status | head -1 | awk '{print $4}' || echo 'online')"
printf "║  🤖 WhatsApp Bot         │ %-35s ║\n" "$(pm2 show whatsai-bot 2>/dev/null | grep status | head -1 | awk '{print $4}' || echo 'online')"
echo "║                                                               ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  RESSOURCES              │ UTILISATION                        ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  💾 Espace Disque        │ %-35s ║\n" "$DISK_USAGE utilisé"
printf "║  🧠 Mémoire RAM          │ %-35s ║\n" "$MEM_USAGE utilisée"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "⚠️  Le service WhatsApp n'a PAS été redémarré (sessions préservées)"
echo "🔗 Site: https://whatsai.ci"
echo ""
