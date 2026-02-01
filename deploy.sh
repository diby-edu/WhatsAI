#!/bin/bash
# WhatsAI Deploy Script (Intelligent)
# Ne redémarre le bot QUE si son code a changé

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              🚀 WhatsAI - Déploiement Intelligent             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

cd ~/WhatsAI

# Get current local commit (before pull)
OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null)

# 1. Récupérer le code
echo "📥 Téléchargement des modifications..."
git fetch origin

# Get remote commit
REMOTE_COMMIT=$(git rev-parse origin/master 2>/dev/null)

# Check if bot code changed between old local and remote
if [ "$OLD_COMMIT" != "$REMOTE_COMMIT" ]; then
    BOT_CHANGED=$(git diff $OLD_COMMIT $REMOTE_COMMIT --name-only 2>/dev/null | grep -E "src/lib/whatsapp|whatsapp-service\.js|ecosystem\.config\.js" || true)
else
    # Already up to date, check if last commit touched bot files
    BOT_CHANGED=$(git diff HEAD~1 HEAD --name-only 2>/dev/null | grep -E "src/lib/whatsapp|whatsapp-service\.js|ecosystem\.config\.js" || true)
fi

# Apply changes
git reset --hard origin/master
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null)

# 2. Si le bot a changé, l'arrêter pour libérer la RAM
if [ -n "$BOT_CHANGED" ]; then
    echo ""
    echo "🔄 Code du bot modifié - arrêt temporaire..."
    echo "   Fichiers modifiés: $BOT_CHANGED"
    pm2 stop whatsai-bot 2>/dev/null || true
    RESTART_BOT=true
else
    echo ""
    echo "✅ Code du bot inchangé - pas de redémarrage nécessaire"
    RESTART_BOT=false
fi

# 3. Installer les dépendances
echo ""
echo "📦 Installation des dépendances..."
npm install --silent

# 4. Build
echo ""
echo "🔨 Compilation en cours..."
rm -f .next/lock
npm run build

# 5. Redémarrer les services
echo ""
echo "🔄 Redémarrage des services..."
pm2 restart whatsai-web 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-web

if [ "$RESTART_BOT" = true ]; then
    pm2 restart whatsai-bot 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-bot
    BOT_ACTION="Redémarré ✅"
else
    BOT_ACTION="Non touché 🔒"
fi

# Wait for services to be ready
sleep 3

# Get status
WEB_STATUS=$(pm2 show whatsai-web 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "online")
BOT_STATUS=$(pm2 show whatsai-bot 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "online")

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                  ✅ DÉPLOIEMENT TERMINÉ                       ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  📌 Nouveau commit   : %-37s ║\n" "$NEW_COMMIT"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  🌐 WhatsAI Web      : %-37s ║\n" "$WEB_STATUS (Redémarré)"
printf "║  🤖 WhatsApp Bot     : %-37s ║\n" "$BOT_STATUS ($BOT_ACTION)"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🔗 Site: https://wazzapai.com"
echo ""
