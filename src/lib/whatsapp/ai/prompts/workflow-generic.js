
const { buildPhysicalWorkflow } = require('./workflow-type-physical')
const { buildDigitalWorkflow } = require('./workflow-type-digital')
const { buildMixedWorkflow } = require('./workflow-mixed')

/**
 * ORCHESTRATEUR DE FLUX GÉNÉRIQUE
 * Dispatche vers le bon workflow selon les types de produits disponibles dans le catalogue.
 * @param {Array} orders - Historique des commandes
 * @param {Array} products - Catalogue produits (nécessaire pour la détection)
 * @param {Object} agent - Agent (nécessaire pour les frais de livraison en mode physique)
 */
function buildGenericWorkflow(orders, products, agent) {
  if (!products || products.length === 0) {
    // Aucun produit configuré : interdire toute invention
    return `
⛔ AUCUN PRODUIT CONFIGURÉ :
Le catalogue de cette boutique est actuellement vide.
Si un client demande des produits, des prix, ou souhaite commander, réponds EXACTEMENT :
"Désolé, aucun produit n'est configuré pour le moment. 😔 Revenez bientôt !"
❌ NE PAS proposer de produits.
❌ NE PAS inventer de prix ou de catalogue.
❌ NE PAS collecter de commande.
`
  }

  // 1. Analyse des types de produits disponibles dans le catalogue
  // Note: 'service' est déjà géré par les engines (STAY/TABLE...), ici on ne gère que le reste
  // 1. Analyse des types de produits disponibles dans le catalogue
  // Note: 'service' est déjà géré par les engines (STAY/TABLE...), ici on ne gère que le reste
  const hasPhysical = products.some(p => p.product_type === 'physical' || p.product_type === 'good' || p.product_type === 'product')
  const hasDigital = products.some(p => p.product_type === 'digital' || p.product_type === 'virtual')

  // 2. Dispatch intelligent
  if (hasPhysical && hasDigital) {
    // Agent mixte (vend des T-shirts et des Licences)
    return buildMixedWorkflow(orders)
  } else if (hasDigital) {
    // Agent 100% Numérique (ou mixte digital + service/null)
    return buildDigitalWorkflow(orders)
  } else if (hasPhysical) {
    // Agent 100% Physique
    return buildPhysicalWorkflow(orders, agent)
  } else {
    // Produits sans type explicite (legacy null / service non-engine) → workflow physique par défaut
    return buildPhysicalWorkflow(orders, agent)
  }
}

module.exports = { buildGenericWorkflow }
