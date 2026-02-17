#!/bin/bash
# WhatsAI Deploy Script v2
# Redémarre TOUJOURS les deux services
# Auto-rollback si le build échoue

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              🚀 WhatsAI - Déploiement v2                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

cd ~/WhatsAI

# Sauvegarder le commit actuel (pour rollback si build échoue)
OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null)
OLD_SHORT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 1. Récupérer le code
echo "📥 Téléchargement des modifications..."
git fetch origin
git reset --hard origin/master
NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 2. Installer les dépendances
echo ""
echo "📦 Installation des dépendances..."
npm install --silent

# 3. Arrêter les services AVANT le build pour libérer la RAM
echo ""
echo "🛑 Arrêt des services pour libérer la RAM..."
pm2 stop whatsai-web 2>/dev/null || true
pm2 stop whatsai-bot 2>/dev/null || true
sleep 3  # Laisser le temps au gracefulShutdown de sauvegarder les sessions

# Nettoyage des anciens processus fantômes
pm2 delete wazzapai-web 2>/dev/null || true
pm2 delete whatsai-web 2>/dev/null || true
pm2 delete whatsai-bot 2>/dev/null || true

# 4. Build
echo ""
echo "🔨 Compilation en cours..."
rm -f .next/lock
npm run build

# Vérifier si le build a réussi (même si le process crash avec core dump)
# Le fichier .next/BUILD_ID n'existe que si la compilation a réussi
if [ ! -f .next/BUILD_ID ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║              ❌ BUILD ÉCHOUÉ — AUTO-ROLLBACK                 ║"
    echo "╠═══════════════════════════════════════════════════════════════╣"
    echo "║  Le build a échoué. Restauration du commit précédent...      ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    git reset --hard $OLD_COMMIT
    npm run build  # Recompiler l'ancienne version
    pm2 start ecosystem.config.js
    pm2 save 2>/dev/null || true
    echo "⏪ Restauré à $OLD_SHORT — services redémarrés"
    exit 1
fi

echo "✅ Build réussi"

# 5. Démarrer les services
echo ""
echo "🔄 Démarrage des services..."
pm2 start ecosystem.config.js
pm2 save 2>/dev/null || true

# Wait for services to be ready
sleep 3

# Get PM2 info
WEB_STATUS=$(pm2 show whatsai-web 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "unknown")
BOT_STATUS=$(pm2 show whatsai-bot 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "unknown")
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f%%", $3/$2 * 100)}')

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              ✅ DÉPLOIEMENT TERMINÉ                           ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  📌 Ancien commit  : %-38s ║\n" "$OLD_SHORT"
printf "║  📌 Nouveau commit : %-38s ║\n" "$NEW_COMMIT"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  🌐 Web    : %-45s ║\n" "$WEB_STATUS"
printf "║  🤖 Bot    : %-45s ║\n" "$BOT_STATUS"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  💾 Disque : %-45s ║\n" "$DISK_USAGE"
printf "║  🧠 RAM    : %-45s ║\n" "$MEM_USAGE"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🔗 Site: https://wazzapai.com"
echo "✅ Sessions WhatsApp préservées (pas de QR re-scan)"
echo ""
