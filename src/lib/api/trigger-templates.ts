/**
 * Templates de messages par type d'événement.
 * Chaque template reçoit les données de l'événement et retourne le message WhatsApp.
 */

export type TriggerEvent =
    | 'cart_abandoned'
    | 'order_created'
    | 'order_shipped'
    | 'payment_failed'
    | 'appointment_reminder'
    | 'welcome'
    | 'custom'

export interface TriggerContext {
    event: TriggerEvent | string
    customer?: {
        name?: string
        phone: string
        email?: string
    }
    cart?: {
        id?: string
        items?: Array<{
            name: string
            variant?: string
            qty?: number
            price?: number
        }>
        total?: number
        currency?: string
    }
    order?: {
        id?: string
        reference?: string
        total?: number
        status?: string
        tracking_url?: string
    }
    appointment?: {
        date?: string
        time?: string
        location?: string
        professional?: string
    }
    data?: Record<string, string | number | boolean>
    message?: string // Pour event "custom" ou surcharge du template
}

type TemplateBuilder = (ctx: TriggerContext) => string

const customerName = (ctx: TriggerContext) =>
    ctx.customer?.name ? `${ctx.customer.name}` : 'vous'

const templates: Record<string, TemplateBuilder> = {
    cart_abandoned: (ctx) => {
        const name = customerName(ctx)
        const items = ctx.cart?.items ?? []
        const total = ctx.cart?.total
        const currency = ctx.cart?.currency ?? 'FCFA'

        const itemLines = items.length > 0
            ? items.map(i => `• ${i.name}${i.variant ? ` (${i.variant})` : ''}${i.qty && i.qty > 1 ? ` × ${i.qty}` : ''}`).join('\n')
            : null

        let msg = `Bonjour ${name} ! 👋\n\nVous avez des articles qui vous attendent dans votre panier :`
        if (itemLines) msg += `\n\n${itemLines}`
        if (total) msg += `\n\nTotal : ${Number(total).toLocaleString('fr-FR')} ${currency}`
        msg += `\n\nSouhaitez-vous finaliser votre commande ? Je suis là pour vous aider. 😊`
        return msg
    },

    order_created: (ctx) => {
        const name = customerName(ctx)
        const ref = ctx.order?.reference || ctx.order?.id || '—'
        const total = ctx.order?.total
        const currency = ctx.cart?.currency ?? 'FCFA'

        let msg = `Bonjour ${name} ! ✅\n\nVotre commande *#${ref}* a bien été reçue et est en cours de traitement.`
        if (total) msg += `\nMontant : ${Number(total).toLocaleString('fr-FR')} ${currency}`
        msg += `\n\nVous avez des questions sur votre commande ? Je suis disponible. 😊`
        return msg
    },

    order_shipped: (ctx) => {
        const name = customerName(ctx)
        const ref = ctx.order?.reference || ctx.order?.id || '—'

        let msg = `Bonjour ${name} ! 🚚\n\nBonne nouvelle : votre commande *#${ref}* est en route !`
        if (ctx.order?.tracking_url) msg += `\n\nSuivez votre livraison : ${ctx.order.tracking_url}`
        msg += `\n\nUne question ? Je suis là.`
        return msg
    },

    payment_failed: (ctx) => {
        const name = customerName(ctx)
        const ref = ctx.order?.reference || ctx.order?.id

        let msg = `Bonjour ${name},\n\nNous n'avons pas pu traiter votre paiement${ref ? ` pour la commande *#${ref}*` : ''}.`
        msg += `\n\nVoulez-vous réessayer ou choisir un autre mode de paiement ? Je peux vous guider. 🙏`
        return msg
    },

    appointment_reminder: (ctx) => {
        const name = customerName(ctx)
        const apt = ctx.appointment

        let msg = `Bonjour ${name} ! 📅\n\nRappel de votre rendez-vous`
        if (apt?.date) msg += ` le *${apt.date}*`
        if (apt?.time) msg += ` à *${apt.time}*`
        if (apt?.location) msg += `\nLieu : ${apt.location}`
        if (apt?.professional) msg += `\nAvec : ${apt.professional}`
        msg += `\n\nSi vous souhaitez modifier ou annuler, répondez à ce message.`
        return msg
    },

    welcome: (ctx) => {
        const name = customerName(ctx)
        return `Bonjour ${name} ! 👋\n\nBienvenue ! Je suis votre assistant. Comment puis-je vous aider aujourd'hui ?`
    },

    custom: (ctx) => {
        return ctx.message || 'Bonjour ! Comment puis-je vous aider ?'
    },
}

/**
 * Génère le message WhatsApp à partir d'un événement et de ses données.
 * Si l'événement n'a pas de template → utilise "custom".
 * Si ctx.message est fourni → surcharge toujours le template.
 */
export function buildTriggerMessage(ctx: TriggerContext): string {
    // Surcharge explicite du message
    if (ctx.message) return ctx.message

    const builder = templates[ctx.event] ?? templates.custom
    return builder(ctx)
}
