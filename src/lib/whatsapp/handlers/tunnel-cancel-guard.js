function normalizeCancelText(value = '') {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function isGlobalTunnelCancelIntent(text = '') {
    const normalized = normalizeCancelText(text)
    if (!normalized) return false

    return [
        /\bannuler\b/,
        /\bannule\b/,
        /\bannulation\b/,
        /\bje veux annuler\b/,
        /\bje souhaite annuler\b/,
        /\bj annule\b/,
        /\bannuler la commande\b/,
        /\bannuler ma commande\b/,
        /\bannuler cette commande\b/,
        /\bje veux annuler la commande\b/,
        /\blaisser tomber\b/,
        /\blaisse tomber\b/,
        /\babandonner la commande\b/,
        /\bstop la commande\b/,
    ].some((pattern) => pattern.test(normalized))
}

function buildActiveTunnelCancelledMessage() {
    return "D'accord. J'ai annule la commande en cours.\n\nVous pouvez maintenant envoyer une nouvelle commande."
}

function resolveActiveTunnelCancellation({
    text = '',
    hasCartState = false,
    hasCheckoutState = false,
}) {
    if (!hasCartState && !hasCheckoutState) return null
    if (!isGlobalTunnelCancelIntent(text)) return null

    return {
        type: 'cancel_active_tunnel',
        content: buildActiveTunnelCancelledMessage(),
    }
}

module.exports = {
    buildActiveTunnelCancelledMessage,
    isGlobalTunnelCancelIntent,
    resolveActiveTunnelCancellation,
}
