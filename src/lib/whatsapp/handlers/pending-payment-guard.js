function normalizeGuardText(value = '') {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

function isAmbiguousPendingPaymentReply(text = '') {
    const normalized = normalizeGuardText(text)
    if (!normalized) return false

    return /^(?:1|2|3|4|ok|okay|oui|continuer|continue|je continue|je confirme|confirmer|go|d accord|daccord)$/.test(normalized)
}

function assistantPromptWasPaymentLink(content = '') {
    const normalized = normalizeGuardText(content)
    return (
        normalized.includes('lien de paiement') ||
        normalized.includes('commande creee') ||
        normalized.includes('commande confirmee') ||
        normalized.includes('paiement securise') ||
        /https?:\/\/\S+\/pay\/[a-z0-9-]+/i.test(String(content || ''))
    )
}

function assistantPromptWasPendingChoice(content = '') {
    const normalized = normalizeGuardText(content)
    return normalized.includes('une commande est deja en attente de paiement')
        && normalized.includes('1. continuer le paiement')
        && normalized.includes('2. annuler cette commande')
}

function findPendingOnlineOrder(orders = [], options = {}) {
    const { conversationId = null, maxAgeHours = 12 } = options
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000
    const now = Date.now()

    const pendingOrders = (orders || [])
        .filter(order =>
            order &&
            order.id &&
            order.status === 'pending' &&
            order.payment_method === 'online'
        )
        .filter(order => {
            if (!order.created_at) return true
            const createdAt = new Date(order.created_at).getTime()
            return Number.isFinite(createdAt) ? now - createdAt <= maxAgeMs : true
        })
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

    if (conversationId) {
        const sameConversationOrder = pendingOrders.find(order => order.conversation_id === conversationId)
        if (sameConversationOrder) return sameConversationOrder
    }

    return pendingOrders[0] || null
}

function buildPendingPaymentReminder(order, escalationPhone = null) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
    const paymentLink = order.provider_payment_url || `${appUrl}/pay/${order.id}`
    const amount = Number(order.total_fcfa || 0).toLocaleString('fr-FR')
    let message = `Votre commande #${String(order.id).substring(0, 8)} attend encore votre paiement.\n\nCliquez ici pour payer :\n${paymentLink}\n\nMontant : ${amount} FCFA`

    if (escalationPhone) {
        message += `\n\nEn cas de besoin, contactez le service client au ${escalationPhone}.`
    }

    message += '\n\nSi vous avez deja paye, ignorez simplement ce message : la confirmation arrivera ici automatiquement.'

    return message
}

function buildPendingPaymentChoicePrompt(order, escalationPhone = null) {
    let message = `Une commande est deja en attente de paiement (#${String(order.id).substring(0, 8)}).\n\nQue souhaitez-vous faire ?\n1. Continuer le paiement\n2. Annuler cette commande et recommencer`

    if (escalationPhone) {
        message += `\n\nEn cas de besoin, contactez le service client au ${escalationPhone}.`
    }

    return message
}

function buildPendingPaymentCancelledMessage(order) {
    return `D'accord. La commande en attente #${String(order.id).substring(0, 8)} a ete annulee.\n\nVous pouvez maintenant envoyer votre nouvelle commande.`
}

function buildPendingPaymentCancellationFailedMessage(order) {
    return `Je n'ai pas pu annuler la commande en attente #${String(order.id).substring(0, 8)} pour le moment.\n\nVeuillez reessayer dans un instant ou me dire si vous souhaitez simplement continuer le paiement.`
}

function isPaymentHelpIntent(text = '') {
    const normalized = normalizeGuardText(text)
    if (!normalized) return false

    return /\b(payer|paiement|payment|lien|clique|cliquer|clic|marche pas|ne marche pas|probleme|problem|impossible|paie plus tard|payer plus tard|jai paye|j ai paye|j'ai paye|j'ai payé|jai payé)\b/.test(normalized)
}

function isExplicitNewOrderIntent(text = '', productNames = []) {
    const normalized = normalizeGuardText(text)
    if (!normalized) return false

    const hasPurchaseVerb = /\b(je veux|je souhaite|ajoute|ajouter|encore|je prends|prendre|commande|commander|aussi|un autre|une autre)\b/.test(normalized)
    if (!hasPurchaseVerb) return false

    const normalizedProductNames = (productNames || [])
        .map(name => normalizeGuardText(name))
        .filter(Boolean)

    return normalizedProductNames.some(name => normalized.includes(name))
}

function resolvePendingPaymentFollowUp({
    text = '',
    lastAssistantMessage = '',
    pendingOrder = null,
    productNames = [],
    escalationPhone = null,
}) {
    if (!pendingOrder) return null

    const normalized = normalizeGuardText(text)
    const choicePromptActive = assistantPromptWasPendingChoice(lastAssistantMessage)

    if (choicePromptActive) {
        if (normalized === '1') {
            return {
                type: 'reminder',
                content: buildPendingPaymentReminder(pendingOrder, escalationPhone),
            }
        }

        if (normalized === '2') {
            return {
                type: 'cancel_pending_order',
                content: buildPendingPaymentCancelledMessage(pendingOrder),
            }
        }

        return {
            type: 'choice',
            content: buildPendingPaymentChoicePrompt(pendingOrder, escalationPhone),
        }
    }

    if (isExplicitNewOrderIntent(text, productNames)) {
        return {
            type: 'choice',
            content: buildPendingPaymentChoicePrompt(pendingOrder, escalationPhone),
        }
    }

    if (
        isAmbiguousPendingPaymentReply(text) ||
        assistantPromptWasPaymentLink(lastAssistantMessage) ||
        isPaymentHelpIntent(text) ||
        normalized
    ) {
        return {
            type: 'reminder',
            content: buildPendingPaymentReminder(pendingOrder, escalationPhone),
        }
    }

    return null
}

module.exports = {
    assistantPromptWasPaymentLink,
    assistantPromptWasPendingChoice,
    buildPendingPaymentCancelledMessage,
    buildPendingPaymentCancellationFailedMessage,
    buildPendingPaymentChoicePrompt,
    buildPendingPaymentReminder,
    findPendingOnlineOrder,
    isAmbiguousPendingPaymentReply,
    isExplicitNewOrderIntent,
    isPaymentHelpIntent,
    resolvePendingPaymentFollowUp,
}
