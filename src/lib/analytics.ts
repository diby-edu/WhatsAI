// Helper GA4 — fire-and-forget, safe si gtag non chargé
export function trackEvent(eventName: string, params?: Record<string, string | number | boolean>) {
    if (typeof window === 'undefined') return
    const g = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
    if (typeof g !== 'function') return
    g('event', eventName, params)
}

// Events standards WazzapAI
export const GA = {
    agentCreated: (mission: string, agentType: string) =>
        trackEvent('agent_created', { mission, agent_type: agentType }),

    agentDeleted: () =>
        trackEvent('agent_deleted'),

    whatsappConnected: (mode: string) =>
        trackEvent('whatsapp_connected', { connection_mode: mode }),

    paymentInitiated: (type: 'subscription' | 'credits', planOrPack: string) =>
        trackEvent('payment_initiated', { payment_type: type, target: planOrPack }),

    userRegistered: (method: 'email' | 'google') =>
        trackEvent('user_registered', { method }),

    productCreated: () =>
        trackEvent('product_created'),

    orderStatusChanged: (status: string) =>
        trackEvent('order_status_changed', { status }),
}
