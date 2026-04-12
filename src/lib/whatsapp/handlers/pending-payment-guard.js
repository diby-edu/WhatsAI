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

    return /^(?:1|2|3|4|ok|okay|oui|continuer|continue|je continue|je confirme|confirmer|go|d accord|daccord|daccord)$/.test(normalized)
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

function shouldHandlePendingPaymentFollowUp({ text = '', lastAssistantMessage = '', pendingOrder = null }) {
    if (!pendingOrder) return false
    if (!isAmbiguousPendingPaymentReply(text)) return false
    return assistantPromptWasPaymentLink(lastAssistantMessage)
}

function buildPendingPaymentReminder(order, escalationPhone = null) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
    const paymentLink = order.provider_payment_url || `${appUrl}/pay/${order.id}`
    const amount = Number(order.total_fcfa || 0).toLocaleString('fr-FR')
    let message = `⏳ Votre commande #${String(order.id).substring(0, 8)} attend encore votre paiement.\n\n💳 Cliquez ici pour payer :\n${paymentLink}\n\n💰 Montant : ${amount} FCFA`

    if (escalationPhone) {
        message += `\n\n📞 En cas de besoin, contactez le service client au ${escalationPhone}.`
    }

    message += '\n\nSi vous avez deja paye, ignorez simplement ce message : la confirmation arrivera ici automatiquement.'

    return message
}

module.exports = {
    assistantPromptWasPaymentLink,
    buildPendingPaymentReminder,
    findPendingOnlineOrder,
    isAmbiguousPendingPaymentReply,
    shouldHandlePendingPaymentFollowUp,
}
