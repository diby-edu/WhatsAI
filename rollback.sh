#!/bin/bash
# WhatsAI — Rollback
# Par défaut : rollback INSTANTANÉ des artefacts (.next_old → .next), sans rebuild.
# Avec --code : retour au commit précédent + réinstallation des dépendances + rebuild.
# Tout dans main() : parse complet avant exécution (sûr même si le fichier change).

main() {
    cd ~/WhatsAI || exit 1

    echo ""
    echo "⏪ WhatsAI — Rollback"
    echo "====================="
    echo ""

    if [ "$1" = "--code" ]; then
        # ── Rollback au niveau du code (commit précédent) ──
        CURRENT=$(git rev-parse --short HEAD)
        echo "📌 Commit actuel: $CURRENT"

        if ! git checkout HEAD~1; then
            echo "❌ Rollback impossible: working tree non propre."
            exit 1
        fi
        NEW=$(git rev-parse --short HEAD)
        echo "📌 Retour à: $NEW"

        echo ""
        echo "📦 Réinstallation des dépendances de la version restaurée..."
        if ! npm ci --include=dev --prefer-offline --no-audit --no-fund; then
            echo "⚠️ npm ci a échoué, tentative avec npm install..."
            if ! npm install --include=dev --no-audit --no-fund; then
                echo "❌ Installation impossible — abandon."
                exit 1
            fi
        fi

        echo ""
        export NODE_OPTIONS="--max-old-space-size=2048"
        export NEXT_DISABLE_ESLINT=1
        rm -f .next/lock

        if grep -q "NEXT_DIST_DIR" next.config.ts 2>/dev/null; then
            # Le commit restauré supporte le build isolé (zero-downtime).
            echo "🔨 Recompilation dans .next_new..."
            rm -rf .next_new
            if ! NEXT_DIST_DIR=.next_new node_modules/.bin/next build || [ ! -f .next_new/BUILD_ID ]; then
                echo "❌ Build de la version restaurée échoué — .next actuel inchangé."
                exit 1
            fi
            rm -rf .next_old
            if [ -d .next ]; then mv .next .next_old; fi
            mv .next_new .next
        else
            # Commit antérieur à la prise en charge de NEXT_DIST_DIR : ce next.config.ts
            # ignorerait la variable et builderait directement dans .next servi.
            # On construit donc directement, avec une brève fenêtre de downtime
            # assumée, plutôt que de corrompre le build en cours de service.
            echo "⚠️  Ce commit ne supporte pas le build isolé — compilation directe dans .next (downtime bref pendant le build)."
            if ! node_modules/.bin/next build; then
                echo "❌ Build de la version restaurée échoué."
                exit 1
            fi
        fi
    else
        # ── Rollback instantané des artefacts (défaut) ──
        if [ ! -d .next_old ]; then
            echo "❌ Pas de .next_old disponible. Utilisez: bash rollback.sh --code"
            exit 1
        fi
        echo "📦 Restauration du dernier build sain (.next_old → .next)..."
        rm -rf .next
        # cp -a (et non mv) : préserve .next_old pour rollbacks futurs
        cp -a .next_old .next
        echo ""
        echo "⚠️  Ce mode ne restaure QUE le build web (.next). whatsai-bot exécute"
        echo "   son code JS directement depuis l'arbre git et ne sera PAS reverté :"
        echo "   son redémarrage ci-dessous relance le même code qu'avant ce rollback."
        echo "   Si le bug suspecté touche le bot (stock, cron, messages WhatsApp),"
        echo "   utilisez : bash rollback.sh --code"
    fi

    echo ""
    echo "🔄 Redémarrage..."
    pm2 restart whatsai-web 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-web
    pm2 restart whatsai-bot 2>/dev/null || pm2 start ecosystem.config.js --only whatsai-bot
    pm2 save 2>/dev/null || true

    echo ""
    echo "🏥 Healthcheck..."
    WEB_HTTP="000"
    for i in $(seq 1 10); do
        sleep 5
        WEB_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 8 http://localhost:3000 2>/dev/null || echo "000")
        if [ "$WEB_HTTP" = "200" ]; then break; fi
        echo "    tentative $i/10 : HTTP $WEB_HTTP..."
    done

    if [ "$WEB_HTTP" != "200" ]; then
        echo "❌ Le site ne répond toujours pas (HTTP $WEB_HTTP) — intervention manuelle requise."
        exit 1
    fi

    echo ""
    echo "✅ Rollback terminé ! (HTTP $WEB_HTTP)"
    echo "🔗 Site: https://wazzapai.com"
    echo ""
    exit 0
}

main "$@"
