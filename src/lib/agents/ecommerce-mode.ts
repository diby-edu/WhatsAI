export const ECOMMERCE_MODE_VALUES = ['native', 'external_sync'] as const

export type EcommerceMode = (typeof ECOMMERCE_MODE_VALUES)[number]

export function normalizeEcommerceMode(value: unknown): EcommerceMode {
    return String(value ?? '').trim().toLowerCase() === 'external_sync'
        ? 'external_sync'
        : 'native'
}

export function resolveAgentEcommerceMode(mission: unknown, value: unknown): EcommerceMode {
    return String(mission ?? '').trim().toLowerCase() === 'ecommerce'
        ? normalizeEcommerceMode(value)
        : 'native'
}

export function isExternalSyncAgent(agent: { mission?: string | null; ecommerce_mode?: string | null } | null | undefined): boolean {
    if (!agent) return false
    return String(agent.mission ?? '').trim().toLowerCase() === 'ecommerce'
        && normalizeEcommerceMode(agent.ecommerce_mode) === 'external_sync'
}

export function blocksManualProducts(agent: { mission?: string | null; ecommerce_mode?: string | null } | null | undefined): boolean {
    if (!agent) return false
    return String(agent.mission ?? '').trim().toLowerCase() === 'support_client'
        || isExternalSyncAgent(agent)
}

export function getManualProductsBlockedReason(agent: { mission?: string | null; ecommerce_mode?: string | null } | null | undefined): string | null {
    if (!agent) return null
    if (String(agent.mission ?? '').trim().toLowerCase() === 'support_client') {
        return "Impossible d'ajouter un produit a un agent Support Client. Utilisez la Base de Connaissances."
    }
    if (isExternalSyncAgent(agent)) {
        return "Impossible d'ajouter un produit manuel a un agent en mode external_sync. Utilisez l'API publique /sync."
    }
    return null
}
