#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# VERIFY PHASE 6 - WazzapAI
# ═══════════════════════════════════════════════════════════════

echo "🚀 Démarrage de la vérification de la Phase 6..."

# 1. Vérifier la table des paramètres globaux
echo -n "[1/3] Vérification de la table app_settings... "
SQL_CHECK=$(psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'app_settings';")
if [ "$SQL_CHECK" -eq "1" ]; then
    echo "✅ OK"
else
    echo "❌ Erreur: Table app_settings introuvable. Exécutez 20260221_global_settings.sql"
fi

# 2. Vérifier les types d'alertes SQL mis à jour
echo -n "[2/3] Vérification de l'alerte high_merchant_balance... "
SQL_ALERT=$(grep "high_merchant_balance" supabase/migrations/20260115_monitoring_views.sql)
if [[ $SQL_ALERT == *"high_merchant_balance"* ]]; then
    echo "✅ OK"
else
    echo "❌ Erreur: L'alerte n'est pas dans le fichier. Re-téléchargez 20260115_monitoring_views.sql"
fi

# 3. Test de l'API Bulk (Simulation d'authentification requise)
echo "[3/3] Pour vérifier l'API Bulk et Pagination :"
echo "   - Accédez à /admin/users dans votre navigateur."
echo "   - Cochez plusieurs utilisateurs."
echo "   - Cliquez sur 'Suspendre' ou 'Changer Rôle'."
echo "   - Vérifiez que l'action apparaît dans /admin/audit-logs."

echo "--------------------------------------------------------"
echo "🎉 Vérification terminée. Si [1] et [2] sont OK, la Phase 6 est prête."
