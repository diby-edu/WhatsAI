
const { buildPhysicalWorkflow } = require('./workflow-type-physical')
const { buildDigitalWorkflow } = require('./workflow-type-digital')
const { buildMixedWorkflow } = require('./workflow-mixed')

/**
 * ORCHESTRATEUR DE FLUX GÉNÉRIQUE
 * Dispatche vers le bon workflow selon les types de produits disponibles dans le catalogue.
 * @param {Array} orders - Historique des commandes
 * @param {Array} products - Catalogue produits (nécessaire pour la détection)
 */
function buildGenericWorkflow(orders, products) {
  if (!products || products.length === 0) {
    // Fallback si pas de produits
    return buildPhysicalWorkflow(orders)
  }

  // 1. Analyse des types de produits disponibles dans le catalogue
  // Note: 'service' est déjà géré par les engines (STAY/TABLE...), ici on ne gère que le reste
  const hasPhysical = products.some(p => !p.product_type || p.product_type === 'physical' || p.product_type === 'good')
  const hasDigital = products.some(p => p.product_type === 'digital' || p.product_type === 'virtual')

  // 2. Dispatch intelligent
  console.log(`🧠 [DEBUG-PRODUCTS] List:`, JSON.stringify(products.map(p => ({ n: p.name, t: p.product_type }))))
  console.log(`🧠 [DEBUG-GENERIC] Physical: ${hasPhysical}, Digital: ${hasDigital}`)
  if (hasPhysical && hasDigital) {
    // Agent mixte (vend des T-shirts et des Licences)
    console.log(`🧠 [DEBUG-GENERIC] -> MIXED WORKFLOW`)
    return buildMixedWorkflow(orders)
  } else if (hasDigital && !hasPhysical) {
    // Agent 100% Numérique
    console.log(`🧠 [DEBUG-GENERIC] -> DIGITAL WORKFLOW`)
    return buildDigitalWorkflow(orders)
  } else {
    // Agent 100% Physique (ou cas par défaut)
    console.log(`🧠 [DEBUG-GENERIC] -> PHYSICAL WORKFLOW`)
    return buildPhysicalWorkflow(orders)
  }
}

module.exports = { buildGenericWorkflow }
