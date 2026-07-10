#!/bin/bash
# ⛔ SCRIPT NEUTRALISÉ (INFRA-5)
# Ce script dupliquait deploy.sh sans aucun garde-fou (pas de vérification
# de build, pas de healthcheck, pas de rollback). Le SEUL point d'entrée
# de déploiement est : bash /root/WhatsAI/deploy.sh
echo "⛔ Ce script est désactivé. Utilisez : bash /root/WhatsAI/deploy.sh"
exit 1
