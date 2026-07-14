#!/bin/bash
# WhatsAI Deploy Script v4 - Zero-Downtime réel
# - Build dans .next_new pendant que le serveur sert .next (jamais de .next vide)
# - Healthcheck HTTP bloquant avec rollback automatique vers .next_old
# - Codes retour vérifiés à chaque étape
# Tout le script est dans main() : bash le parse entièrement avant exécution,
# donc un git merge qui remplace ce fichier en cours de route est sans danger.

main() {
    clear
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║         🚀 WhatsAI - Déploiement v4 (Zero-Downtime)          ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"

    cd ~/WhatsAI || exit 1
    START_TIME=$(date +%s)
    FORCE_BUILD=0
    [ "$1" = "--force" ] && FORCE_BUILD=1

    # Sauvegarder commit actuel pour rollback
    OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

    # ═══════════════════════════════════════════════════════════
    # 1. GIT PULL (services TOUJOURS UP)
    # ═══════════════════════════════════════════════════════════
    echo ""
    echo "📥 [1/5] Récupération du code..."
    git fetch origin
    # Discarter les modifications locales de fichiers de config (éditées parfois directement sur VPS)
    git checkout -- deploy.sh rollback.sh ecosystem.config.js scripts/update.sh 2>/dev/null || true
    if ! git merge --ff-only origin/master; then
        echo "❌ Fast-forward merge impossible (working tree not clean or divergent)."
        exit 1
    fi
    NEW_COMMIT=$(git rev-parse --short HEAD)

    if [ "$OLD_COMMIT" = "$NEW_COMMIT" ] && [ "$FORCE_BUILD" != "1" ]; then
        echo "✅ Déjà à jour ($NEW_COMMIT) - Rien à faire (--force pour rebuilder)"
        exit 0
    fi

    echo "    $OLD_COMMIT → $NEW_COMMIT"

    # ═══════════════════════════════════════════════════════════
    # 2. NPM INSTALL (services TOUJOURS UP) — codes retour vérifiés
    # ═══════════════════════════════════════════════════════════
    echo ""
    echo "📦 [2/5] Installation des dépendances..."
    if ! npm ci --include=dev --prefer-offline --no-audit --no-fund; then
        echo "⚠️ npm ci a échoué, tentative avec npm install..."
        if ! npm install --include=dev --no-audit --no-fund; then
            echo "❌ npm install a échoué aussi — abandon (site inchangé, toujours up)."
            exit 1
        fi
    fi

    if [ ! -x node_modules/.bin/next ]; then
        echo ""
        echo "❌ Dépendances incomplètes : next introuvable dans node_modules/.bin"
        echo "   Lancez : npm install --include=dev"
        exit 1
    fi

    # ═══════════════════════════════════════════════════════════
    # 3. BUILD DANS .next_new (le .next servi n'est JAMAIS touché)
    # ═══════════════════════════════════════════════════════════
    echo ""
    echo "🔨 [3/5] Compilation dans .next_new (site toujours up)..."
    rm -rf .next_new
    # Purger les types générés par d'anciens builds : ils peuvent référencer des
    # pages supprimées et casser le typecheck. Inutilisés au runtime (next start).
    rm -rf .next/types .next/dev/types
    # Augmenter mémoire Node et désactiver Lint pour éviter OOM crash sur VPS
    export NODE_OPTIONS="--max-old-space-size=2048"
    export NEXT_DISABLE_ESLINT=1
    NEXT_DIST_DIR=.next_new node_modules/.bin/next build
    BUILD_RC=$?

    if [ "$BUILD_RC" != "0" ] || [ ! -f .next_new/BUILD_ID ]; then
        echo ""
        echo "❌ BUILD ÉCHOUÉ (rc=$BUILD_RC) — le site actuel n'a pas été touché, il reste up."
        rm -rf .next_new
        exit 1
    fi
    echo "✅ Build réussi ($(cat .next_new/BUILD_ID))"

    # ═══════════════════════════════════════════════════════════
    # 4. BASCULE ATOMIQUE + RESTART (~10 s de micro-downtime)
    # ═══════════════════════════════════════════════════════════
    echo ""
    echo "🔄 [4/5] Bascule .next_new → .next et redémarrage..."

    # .next_old = dernier build sain (pour rollback instantané)
    rm -rf .next_old
    if [ -d .next ]; then mv .next .next_old; fi
    mv .next_new .next

    # Nettoyer les vieux processus fantômes
    pm2 delete wazzapai-web 2>/dev/null || true

    # Restart web (reload causait des InvariantError sur les manifests Next.js)
    # Restart pour le bot (sessions Baileys doivent être préservées)
    pm2 restart whatsai-web --update-env 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-web
    pm2 restart whatsai-bot 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-bot
    pm2 save 2>/dev/null || true

    # ═══════════════════════════════════════════════════════════
    # 5. HEALTHCHECK BLOQUANT — rollback auto si le runtime est cassé
    # ═══════════════════════════════════════════════════════════
    echo ""
    echo "🏥 [5/5] Healthcheck (bloquant)..."
    WEB_HTTP="000"
    for i in $(seq 1 12); do
        sleep 5
        WEB_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 8 http://localhost:3000 2>/dev/null || echo "000")
        if [ "$WEB_HTTP" = "200" ]; then break; fi
        echo "    tentative $i/12 : HTTP $WEB_HTTP..."
    done

    if [ "$WEB_HTTP" != "200" ]; then
        echo ""
        echo "❌ HEALTHCHECK ÉCHOUÉ (HTTP $WEB_HTTP) — ROLLBACK AUTOMATIQUE vers .next_old..."
        if [ -d .next_old ]; then
            rm -rf .next
            # cp -a (et non mv) : préserve .next_old pour rollbacks futurs
            cp -a .next_old .next

            # whatsai-bot exécute son code JS directement depuis l'arbre git (pas
            # depuis .next) : sans revenir aussi au commit précédent, le rollback
            # "réussi" laisserait le bot tourner sur le commit cassé.
            if [ "$OLD_COMMIT" != "unknown" ] && [ "$OLD_COMMIT" != "$NEW_COMMIT" ]; then
                if git checkout "$OLD_COMMIT" 2>&1; then
                    echo "⏪ Code source revenu au commit $OLD_COMMIT"
                else
                    echo "⚠️  git checkout vers $OLD_COMMIT a échoué — bot potentiellement toujours sur le commit cassé."
                fi
            fi

            pm2 restart whatsai-web 2>/dev/null || true
            pm2 restart whatsai-bot 2>/dev/null || true
            sleep 8
            ROLLBACK_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 8 http://localhost:3000 2>/dev/null || echo "000")
            echo "⏪ Rollback appliqué (web + bot) — healthcheck post-rollback : HTTP $ROLLBACK_HTTP"
        else
            echo "⚠️  Pas de .next_old disponible — intervention manuelle requise."
        fi
        exit 1
    fi

    BOT_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/health 2>/dev/null || echo "000")
    WEB_STATUS=$(pm2 show whatsai-web 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "unknown")
    BOT_STATUS=$(pm2 show whatsai-bot 2>/dev/null | grep "status" | head -1 | awk '{print $4}' || echo "unknown")

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
    exit 0
}

main "$@"
