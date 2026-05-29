/**
 * Templates de messages par type d'événement.
 * Chaque template reçoit les données de l'événement et retourne le message WhatsApp.
 */

export type TriggerEvent =
    | 'cart_abandoned'
    | 'order_created'
    | 'order_shipped'
    | 'payment_confirmed'
    | 'payment_failed'
    | 'appointment_reminder'
    | 'welcome'
    | 'license_activated'
    | 'license_expired'
    | 'license_issued'
    | 'license_revoked'
    | 'affiliate_joined'
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

const formatOrderReference = (value?: string, fallback = '—') => {
    const raw = (value || '').trim()
    const cleaned = raw.replace(/^#+\s*/, '')
    const finalRef = cleaned || fallback
    if (!finalRef) return ''
    if (finalRef === '—') return finalRef
    return `#${finalRef}`
}

const templates: Record<string, TemplateBuilder> = {
    cart_abandoned: (ctx) => {
        const name = customerName(ctx)
        const items = ctx.cart?.items ?? []
        const total = ctx.cart?.total
        const currency = ctx.cart?.currency ?? 'FCFA'
        const amountFormatted = ctx.data?.amount_formatted as string | undefined
        const storeUrl = ctx.data?.store_url as string | undefined

        const itemLines = items.length > 0
            ? items.map(i => `• ${i.name}${i.variant ? ` (${i.variant})` : ''}${i.qty && i.qty > 1 ? ` × ${i.qty}` : ''}`).join('\n')
            : null

        let msg = `Bonjour ${name} ! 👋\n\nVous avez laissé quelque chose derrière vous :`
        if (itemLines) msg += `\n\n${itemLines}`
        if (amountFormatted) {
            msg += `\nTotal : ${amountFormatted}`
        } else if (total != null) {
            const n = Number(total)
            msg += `\n\nTotal : ${Number.isNaN(n) ? total : n.toLocaleString('fr-FR') + ' ' + currency}`
        }
        if (storeUrl) msg += `\n\n🛒 Reprendre votre commande : ${storeUrl}`
        return msg
    },

    payment_confirmed: (ctx) => {
        const name = customerName(ctx)
        const ref = formatOrderReference(ctx.order?.reference || ctx.order?.id, '')
        const downloadUrl = ctx.data?.download_url as string | undefined
        const licenseKey = ctx.data?.license_key as string | undefined
        const productName = ctx.data?.product_name as string | undefined
        const portalUrl = ctx.data?.portal_url as string | undefined
        const amountFormatted = ctx.data?.amount_formatted as string | undefined
        const total = ctx.order?.total
        const currency = ctx.cart?.currency ?? 'FCFA'

        let amountStr: string | undefined
        if (amountFormatted) {
            amountStr = amountFormatted
        } else if (total != null) {
            const n = Number(total)
            amountStr = Number.isNaN(n) ? String(total) : n.toLocaleString('fr-FR') + ' ' + currency
        }

        const password = ref ? ref.replace(/^#/, '') : undefined

        let msg = `Bonjour ${name} ! ✅\n\n`
        msg += amountStr ? `Votre paiement de *${amountStr}* a bien été reçu.` : `Votre paiement a bien été reçu.`
        if (productName) msg += `\n\n📦 Produit : *${productName}*`
        if (downloadUrl) msg += `\n📥 Téléchargement : ${downloadUrl}`
        if (licenseKey) msg += `\n🔑 Clé de licence : \`${licenseKey}\``
        else if (password && !downloadUrl) msg += `\n🔑 Mot de passe du fichier : ${password}`
        if (portalUrl && !downloadUrl) msg += `\n🔗 Accéder à votre achat : ${portalUrl}`
        if (!downloadUrl && !licenseKey && !portalUrl) msg += `\n\nVous recevrez votre produit dans quelques instants.`
        msg += `\n\nMerci pour votre achat ! 🙏`
        return msg
    },

    order_created: (ctx) => {
        const name = customerName(ctx)
        const ref = formatOrderReference(ctx.order?.reference || ctx.order?.id, '—')
        const total = ctx.order?.total
        const currency = ctx.cart?.currency ?? 'FCFA'

        let msg = `Bonjour ${name} ! ✅\n\nVotre commande *${ref}* a bien été reçue et est en cours de traitement.`
        if (total != null) {
            const n = Number(total)
            msg += `\nMontant : ${Number.isNaN(n) ? total : n.toLocaleString('fr-FR') + ' ' + currency}`
        }
        msg += `\n\nVous avez des questions sur votre commande ? Je suis disponible. 😊`
        return msg
    },

    order_shipped: (ctx) => {
        const name = customerName(ctx)
        const ref = formatOrderReference(ctx.order?.reference || ctx.order?.id, '—')

        let msg = `Bonjour ${name} ! 🚚\n\nBonne nouvelle : votre commande *${ref}* est en route !`
        if (ctx.order?.tracking_url) msg += `\n\nSuivez votre livraison : ${ctx.order.tracking_url}`
        msg += `\n\nUne question ? Je suis là.`
        return msg
    },

    payment_failed: (ctx) => {
        const name = customerName(ctx)
        const productName = ctx.data?.product_name as string | undefined
        const productUrl = ctx.data?.product_url as string | undefined
        const amountFormatted = ctx.data?.amount_formatted as string | undefined
        const total = ctx.order?.total
        const currency = ctx.cart?.currency ?? 'FCFA'

        let amountStr: string | undefined
        if (amountFormatted) {
            amountStr = amountFormatted
        } else if (total != null) {
            const n = Number(total)
            amountStr = Number.isNaN(n) ? String(total) : n.toLocaleString('fr-FR') + ' ' + currency
        }

        let msg = `Bonjour ${name},\n\n`
        if (amountStr && productName) {
            msg += `Votre paiement de *${amountStr}* pour *${productName}* n'a pas pu être traité.`
        } else if (amountStr) {
            msg += `Votre paiement de *${amountStr}* n'a pas pu être traité.`
        } else if (productName) {
            msg += `Votre paiement pour *${productName}* n'a pas pu être traité.`
        } else {
            msg += `Nous n'avons pas pu traiter votre paiement.`
        }
        if (productUrl) msg += `\n\n🔄 Réessayez votre achat : ${productUrl}`
        return msg
    },

    license_activated: (ctx) => {
        const name = customerName(ctx)
        const product = ctx.data?.product_name as string | undefined
        const licenseKey = ctx.data?.license_key as string | undefined
        const portal = ctx.data?.portal_url as string | undefined
        let msg = `Bonjour ${name} ! 🔓\n\nVotre licence${product ? ` pour *${product}*` : ''} a été activée avec succès.`
        if (licenseKey) msg += `\n\n🔑 Clé : \`${licenseKey}\``
        if (portal) msg += `\n🔗 Gérer vos licences : ${portal}`
        msg += `\n\nMerci pour votre confiance ! 🙏`
        return msg
    },

    license_issued: (ctx) => {
        const name = customerName(ctx)
        const product = ctx.data?.product_name as string | undefined
        const licenseKey = ctx.data?.license_key as string | undefined
        const portal = ctx.data?.portal_url as string | undefined
        let msg = `Bonjour ${name} ! 🎉\n\nVotre licence${product ? ` pour *${product}*` : ''} a été émise.`
        if (licenseKey) msg += `\n\n🔑 Clé : \`${licenseKey}\``
        if (portal) msg += `\n🔗 Accédez à votre licence : ${portal}`
        return msg
    },

    license_expired: (ctx) => {
        const name = customerName(ctx)
        const product = ctx.data?.product_name as string | undefined
        const portal = ctx.data?.portal_url as string | undefined
        let msg = `Bonjour ${name},\n\nVotre licence${product ? ` pour *${product}*` : ''} a expiré.`
        if (portal) msg += `\n\n🔗 Renouvelez votre licence : ${portal}`
        msg += `\n\nBesoin d'aide ? Répondez à ce message.`
        return msg
    },

    license_revoked: (ctx) => {
        const name = customerName(ctx)
        const product = ctx.data?.product_name as string | undefined
        const portal = ctx.data?.portal_url as string | undefined
        let msg = `Bonjour ${name},\n\nVotre licence${product ? ` pour *${product}*` : ''} a été révoquée.`
        if (portal) msg += `\n\n🔗 Plus d'informations : ${portal}`
        msg += `\n\nPour toute question, répondez à ce message.`
        return msg
    },

    affiliate_joined: (ctx) => {
        const name = customerName(ctx)
        const portal = ctx.data?.portal_url as string | undefined
        let msg = `Bonjour ${name} ! 🤝\n\nBienvenue dans notre programme d'affiliation !`
        if (portal) msg += `\n\n🔗 Accédez à votre espace affilié : ${portal}`
        msg += `\n\nMerci de nous rejoindre ! 🙏`
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
