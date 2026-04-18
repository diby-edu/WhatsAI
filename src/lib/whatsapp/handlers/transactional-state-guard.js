function shouldBypassTransactionalFlow({ pendingPaymentResolution = null, activeTunnelCancellation = null } = {}) {
    return Boolean(pendingPaymentResolution || activeTunnelCancellation)
}

function shouldPersistTransactionalMetadataAfterResponse({ pendingPaymentResolution = null, activeTunnelCancellation = null } = {}) {
    if (activeTunnelCancellation) {
        return true
    }

    if (!pendingPaymentResolution) {
        return true
    }

    return pendingPaymentResolution.type === 'cancelled'
}

module.exports = {
    shouldBypassTransactionalFlow,
    shouldPersistTransactionalMetadataAfterResponse,
}
