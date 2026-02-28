#!/bin/bash
# WhatsAI — Rollback (revenir au commit précédent)

cd ~/WhatsAI

echo ""
echo "⏪ WhatsAI — Rollback"
echo "====================="
echo ""

CURRENT=$(git rev-parse --short HEAD)
echo "📌 Commit actuel: $CURRENT"

if ! git checkout HEAD~1; then
    echo "Rollback impossible: working tree non propre."
    exit 1
fi
NEW=$(git rev-parse --short HEAD)
echo "📌 Retour à: $NEW"

echo ""
echo "🔨 Recompilation..."
rm -f .next/lock
npm run build

echo ""
echo "🔄 Redémarrage..."
pm2 delete whatsai-web 2>/dev/null || true
pm2 delete whatsai-bot 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save 2>/dev/null || true

echo ""
echo "✅ Rollback terminé ! ($CURRENT → $NEW)"
echo "🔗 Site: https://wazzapai.com"
echo ""
