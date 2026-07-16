import type { PlatformProvider, PlatformEventOption } from './types'

export const WEBHOOK_EVENTS = [
    'message.received',
    'message.sent',
    'conversation.started',
    'conversation.ended',
    'lead.collected',
] as const

export const PLATFORM_PROVIDERS = [
    { value: 'shopify',    label: 'Shopify',    group: 'ecommerce' },
    { value: 'woocommerce',label: 'WooCommerce',group: 'ecommerce' },
    { value: 'chariow',   label: 'Chariow',    group: 'ecommerce' },
    { value: 'maketou',   label: 'Maketou',    group: 'ecommerce' },
    { value: 'generic',   label: 'Webhook générique (ta plateforme → WazzapAI)', group: 'advanced' },
    { value: 'api_key',   label: 'Code personnalisé (ton code → WazzapAI)',      group: 'advanced' },
] as const

export const PROVIDER_PLACEHOLDERS: Record<string, string> = {
    shopify:     'Ex: Boutique Shopify principale',
    woocommerce: 'Ex: Boutique WooCommerce principale',
    chariow:     'Ex: Boutique Chariow',
    maketou:     'Ex: Ma boutique Maketou',
    generic:     'Ex: Ma plateforme custom',
    api_key:     'Ex: Ma clé API principale',
}

export const PROVIDER_DESCRIPTIONS: Record<string, string> = {
    shopify:     "Collez l'URL générée dans les paramètres webhook de votre boutique Shopify.",
    woocommerce: "Collez l'URL générée dans WooCommerce → Extensions → Webhooks.",
    chariow:     "Collez l'URL générée dans Chariow Pulse.",
    maketou:     "Collez l'URL générée dans les paramètres de votre boutique Maketou.",
    generic:     "Collez l'URL générée dans les paramètres webhook de votre plateforme. Aucun code requis.",
    api_key:     "Utilisez la clé générée dans votre code pour appeler WazzapAI. Nécessite un développeur.",
}

export const PLATFORM_SYNC_PROVIDERS = [
    { value: 'woocommerce', label: 'WooCommerce' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'chariow', label: 'Chariow' },
] as const

export const PLATFORM_SYNC_INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 180, 360, 720, 1440] as const

export const PLATFORM_EVENT_OPTIONS: Record<PlatformProvider, PlatformEventOption[]> = {
    shopify: [
        { value: 'orders/create', label: 'Commande creee (orders/create)' },
        { value: 'orders/paid', label: 'Commande payee (orders/paid)' },
        { value: 'orders/fulfilled', label: 'Commande expediee (orders/fulfilled)' },
        { value: 'orders/updated', label: 'Commande mise a jour (orders/updated)' },
        { value: 'checkouts/update', label: 'Checkout mis a jour (checkouts/update)' },
        { value: 'carts/update', label: 'Panier mis a jour (carts/update)' },
    ],
    woocommerce: [
        { value: 'order.created', label: 'Commande creee (order.created)' },
        { value: 'order.updated', label: 'Commande mise a jour (order.updated)' },
        { value: 'order.failed', label: 'Paiement echoue (order.failed)' },
        { value: 'order.pending', label: 'Paiement en attente (order.pending)' },
        { value: 'order.deleted', label: 'Commande supprimee (order.deleted)' },
    ],
    chariow: [
        { value: 'payment_confirmed', label: 'Vente reussie' },
        { value: 'cart_abandoned', label: 'Panier abandonne' },
        { value: 'payment_failed', label: 'Paiement echoue' },
    ],
    maketou: [
        { value: 'order_created', label: 'Commande creee (order_created)' },
        { value: 'order_paid', label: 'Commande payee (order_paid)' },
        { value: 'cart_abandoned', label: 'Panier abandonne (cart_abandoned)' },
        { value: 'payment_failed', label: 'Paiement echoue (payment_failed)' },
    ],
    generic: [
        { value: 'order_created', label: 'Commande creee (order_created)' },
        { value: 'order_shipped', label: 'Commande expediee (order_shipped)' },
        { value: 'cart_abandoned', label: 'Panier abandonne (cart_abandoned)' },
        { value: 'payment_failed', label: 'Paiement echoue (payment_failed)' },
        { value: 'custom', label: 'Evenement personnalise (custom)' },
    ],
}
