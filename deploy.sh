#!/bin/bash
# WhatsAI Deploy Script v3 - Zero-Downtime
# Build PENDANT que les services tournent

clear
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         🚀 WhatsAI - Déploiement v3 (Zero-Downtime)          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"

cd ~/WhatsAI
START_TIME=$(date +%s)

# Sauvegarder commit actuel pour rollback
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# ═══════════════════════════════════════════════════════════
# 1. GIT PULL (services TOUJOURS UP)
# ═══════════════════════════════════════════════════════════
echo ""
echo "📥 [1/4] Récupération du code..."
git fetch origin
if ! git merge --ff-only origin/master; then
    echo "Fast-forward merge impossible (working tree not clean or divergent)."
    exit 1
fi
NEW_COMMIT=$(git rev-parse --short HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    echo "✅ Déjà à jour ($NEW_COMMIT) - Rien à faire"
    exit 0
fi

echo "    $OLD_COMMIT → $NEW_COMMIT"

# ═══════════════════════════════════════════════════════════
# 2. NPM INSTALL RAPIDE (services TOUJOURS UP)
# ═══════════════════════════════════════════════════════════
echo ""
echo "📦 [2/4] Installation des dépendances..."
# npm ci est plus rapide que npm install (pas de résolution)
# --include=dev garantit les dépendances nécessaires au build
# --prefer-offline utilise le cache local quand disponible
if ! npm ci --include=dev --prefer-offline --no-audit --no-fund; then
    echo "⚠️ npm ci a échoué, tentative avec npm install..."
    npm install --include=dev --no-audit --no-fund
fi

if [ ! -x node_modules/.bin/next ]; then
    echo ""
    echo "❌ Dépendances incomplètes : next introuvable dans node_modules/.bin"
    echo "   Lancez : npm install --include=dev"
    exit 1
fi

# ═══════════════════════════════════════════════════════════
# 3. BUILD NEXT.JS (services TOUJOURS UP - ZERO DOWNTIME)
# ═══════════════════════════════════════════════════════════
echo ""
echo "🔨 [3/4] Compilation (optimisation RAM)..."
rm -f .next/lock
# Augmenter mémoire Node et désactiver Lint pour éviter OOM crash sur VPS
export NODE_OPTIONS="--max-old-space-size=2048"
export NEXT_DISABLE_ESLINT=1
node_modules/.bin/next build

# Vérifier si build réussi
if [ ! -f .next/BUILD_ID ]; then
    echo ""
    echo "❌ BUILD ÉCHOUÉ - Rollback vers .next_old..."
    if [ -d .next_old ]; then
        rm -rf .next && mv .next_old .next
        pm2 restart whatsai-web 2>/dev/null || true
        echo "⏪ Rollback .next_old appliqué - site restauré"
    else
        echo "⚠️  Pas de .next_old disponible - site peut être down"
    fi
    exit 1
fi

echo "✅ Build réussi"
# Backup pour rollback instantané si besoin
rm -rf .next_old && cp -a .next .next_old

# ═══════════════════════════════════════════════════════════
# 4. RESTART RAPIDE (~10 secondes de micro-downtime)
# ═══════════════════════════════════════════════════════════
echo ""
echo "🔄 [4/4] Redémarrage des services..."

# Nettoyer les vieux processus fantômes
pm2 delete wazzapai-web 2>/dev/null || true

# Restart web (reload causait des InvariantError sur les manifests Next.js)
# Restart pour le bot (sessions Baileys doivent être préservées)
pm2 restart whatsai-web --update-env 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-web
pm2 restart whatsai-bot 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-bot

pm2 save 2>/dev/null || true

# ═══════════════════════════════════════════════════════════
# 5. HEALTHCHECK
# ═══════════════════════════════════════════════════════════
echo ""
echo "🏥 Vérification des services..."
sleep 5

WEB_STATUS=$(pm2 show whatsai-web 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "unknown")
BOT_STATUS=$(pm2 show whatsai-bot 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "unknown")

# HTTP healthcheck
WEB_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000 2>/dev/null || echo "000")
BOT_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/health 2>/dev/null || echo "000")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
DURATION_MIN=$((DURATION / 60))
DURATION_SEC=$((DURATION % 60))
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f%%", $3/$2 * 100)}')
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              ✅ DÉPLOIEMENT TERMINÉ                           ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  📌 Commit     : %-10s → %-27s ║\n" "$OLD_COMMIT" "$NEW_COMMIT"
printf "║  ⏱️  Durée      : %dm %ds %-35s ║\n" "$DURATION_MIN" "$DURATION_SEC" ""
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  🌐 Web        : %-8s (HTTP: %-3s)                       ║\n" "$WEB_STATUS" "$WEB_HTTP"
printf "║  🤖 Bot        : %-8s (HTTP: %-3s)                       ║\n" "$BOT_STATUS" "$BOT_HTTP"
echo "╠═══════════════════════════════════════════════════════════════╣"
printf "║  💾 Disque     : %-42s ║\n" "$DISK_USAGE"
printf "║  🧠 RAM        : %-42s ║\n" "$MEM_USAGE"
printf "║  🔥 CPU        : %-42s ║\n" "$CPU_USAGE"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "🔗 Site: https://wazzapai.com"
echo "✅ Sessions WhatsApp préservées (pas de QR re-scan)"
echo ""
